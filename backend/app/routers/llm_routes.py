from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from collections import Counter
import httpx
from typing import Optional
from pydantic import BaseModel, Field

from ..database import get_db
from ..auth import get_current_user, require_admin
from .. import models, schemas, crud
from ..llm_client import extract_charts, cited_project_ids
from ..llm_providers import build_provider, SYSTEM_PROMPT, ProviderError, PROVIDERS

router = APIRouter(prefix="/api/llm", tags=["llm"])


# ---------------------------------------------------------------------------
# Settings → provider resolution
# ---------------------------------------------------------------------------

def _provider_credentials(db: Session, name: str) -> dict:
    """Look up provider-specific base_url / api_key / cert_path from settings."""
    n = (name or "openai").lower()
    base_url = crud.get_setting(db, f"llm_{n}_base_url", "")
    api_key = crud.get_setting(db, f"llm_{n}_api_key", "")
    cert_path = crud.get_setting(db, f"llm_{n}_cert_path", "")
    return {"base_url": base_url, "api_key": api_key, "cert_path": cert_path}


def _resolve_provider_from_db(db: Session):
    name = crud.get_setting(db, "llm_provider", "openai")
    creds = _provider_credentials(db, name)
    return build_provider(name, **creds), name


def _max_tokens(db: Session) -> int:
    raw = crud.get_setting(db, "llm_max_tokens", "16384")
    try:
        return max(1, int(raw))
    except ValueError:
        return 16384


# ---------------------------------------------------------------------------
# Pydantic bodies
# ---------------------------------------------------------------------------

class ProviderProbeBody(BaseModel):
    """Optional request body for /models: lets the UI test an unsaved
    configuration without having to write it to the DB first."""
    provider: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    cert_path: Optional[str] = None


class ProviderTestBody(BaseModel):
    """Request body for /test — checks whether a saved provider config
    actually answers a round-trip. `provider` is required; other fields
    override the saved creds when supplied."""
    provider: str
    model: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    cert_path: Optional[str] = None


# ---------------------------------------------------------------------------
# Context builder (unchanged)
# ---------------------------------------------------------------------------

def _truncate(text: str, limit: int) -> str:
    """Compress whitespace and cap length. Keeps the LLM prompt readable and
    avoids one verbose project eating the entire context window."""
    flat = " ".join((text or "").split())
    if len(flat) <= limit:
        return flat
    return flat[: limit - 1] + "…"


def _site_resources(db: Session) -> list[str]:
    """Admin-configured team resources the LLM can point users at when it
    can't answer from portfolio data. All values optional; empties are
    filtered out so we only surface what's actually configured."""
    out: list[str] = []
    team_email = crud.get_setting(db, "team_email", "").strip()
    email_subject = crud.get_setting(db, "team_email_subject", "").strip()
    if team_email:
        if email_subject:
            out.append(f'Team email: <mailto:{team_email}?subject={email_subject}>  '
                       f'(name: "Email the team")')
        else:
            out.append(f"Team email: <mailto:{team_email}>  (name: \"Email the team\")")
    for i in (1, 2, 3):
        label = crud.get_setting(db, f"footer_link_{i}_label", "").strip()
        url = crud.get_setting(db, f"footer_link_{i}_url", "").strip()
        if label and url:
            out.append(f'{label}: <{url}>')
    return out


def _build_context(db: Session) -> str:
    projects = db.query(models.Project).all()
    rows = [crud.project_to_dict(p) for p in projects]

    total = len(rows)
    open_n = sum(1 for r in rows if r["status"] == "open")
    closed_n = total - open_n

    type_counts = Counter(r["project_type"] for r in rows)
    hub_counts = Counter(r["campaign_hub"] for r in rows)
    tech_counts = Counter(t for r in rows for t in r["technologies"])
    tool_counts = Counter(t for r in rows for t in r["tools"])
    os_counts = Counter(o for r in rows for o in r["os_list"])
    collab_counts = Counter(c for r in rows for c in r["collaborators"])
    customer_counts = Counter(r["end_customer"] for r in rows if r["end_customer"])

    durations = [(r["end_date"] - r["start_date"]).days
                 for r in rows if r["end_date"] and r["start_date"]]
    avg_dur = round(sum(durations) / len(durations), 1) if durations else 0

    stage_totals: dict[str, list[int]] = {}
    for r in rows:
        if r["status"] == "closed":
            for s in r["stages"]:
                stage_totals.setdefault(s["stage_name"], []).append(s["days_spent"])
    stage_line = ", ".join(
        f"{k}={round(sum(v)/len(v),1)}d avg over {len(v)} projects"
        for k, v in stage_totals.items()
    )

    def _fmt(c: Counter, n=6):
        return ", ".join(f"{k} ({v})" for k, v in c.most_common(n))

    header = [
        "PORTFOLIO SUMMARY",
        f"- {total} projects total ({open_n} open, {closed_n} closed)",
        f"- Average duration (closed): {avg_dur} days",
        f"- Project types: {_fmt(type_counts)}",
        f"- Campaign hubs: {_fmt(hub_counts)}",
        f"- Top technologies: {_fmt(tech_counts, 8)}",
        f"- Top tools: {_fmt(tool_counts, 8)}",
        f"- Operating systems: {_fmt(os_counts)}",
        f"- Top collaborators: {_fmt(collab_counts, 6)}",
        f"- End customers: {_fmt(customer_counts, 6)}",
        f"- Stage averages (closed): {stage_line}",
    ]

    # Admin-configured fallback resources — the LLM should point users here
    # when a question can't be answered from project data.
    resources = _site_resources(db)
    resource_block = []
    if resources:
        resource_block = ["", "TEAM RESOURCES (use these when questions fall outside the portfolio data)", ""]
        resource_block.extend(f"- {r}" for r in resources)

    lines = ["", "PROJECTS (cite with [[id]])", ""]
    for r in sorted(rows, key=lambda x: x["id"]):
        days = ""
        if r["end_date"] and r["start_date"]:
            days = f" ({(r['end_date'] - r['start_date']).days}d)"
        dates = f"{r['start_date']}→{r['end_date']}" if r["end_date"] else f"{r['start_date']}→open"
        lines.append(
            f"[[{r['id']}]] {r['name']} | {r['status']} {r['project_type']} | "
            f"hub={r['campaign_hub']} | {dates}{days} | "
            f"team={r['team_size']} | lead={r['project_lead'] or 'unknown'} | "
            f"customer={r['end_customer'] or 'none'} | outcome={r['outcome']}"
        )
        if r["target_vendor"] or r["target_product"]:
            tgt = f"{r['target_vendor']} {r['target_product']}".strip()
            lines.append(f"   target: {tgt} | arch={r['cpu_arch'] or 'unspecified'}")
        if r["technologies"]: lines.append(f"   tech: {', '.join(r['technologies'])}")
        if r["tools"]:        lines.append(f"   tools: {', '.join(r['tools'])}")
        if r["languages"]:    lines.append(f"   languages: {', '.join(r['languages'])}")
        if r["os_list"]:      lines.append(f"   os: {', '.join(r['os_list'])}")
        if r["collaborators"]: lines.append(f"   collabs: {', '.join(r['collaborators'])}")
        if r["tags"]:         lines.append(f"   tags: {', '.join(r['tags'])}")
        if r["stages"]:
            stages_str = ", ".join(f"{s['stage_name']}={s['days_spent']}d" for s in r["stages"])
            lines.append(f"   stages: {stages_str}")
        # Counts that matter for analytics questions
        if r["vulnerabilities_discovered"] or r["hs_equities"] or r["operational_success"]:
            bits = []
            if r["vulnerabilities_discovered"]: bits.append(f"vulns={r['vulnerabilities_discovered']}")
            if r["hs_equities"]:                bits.append(f"equities={r['hs_equities']}")
            if r["operational_success"]:        bits.append("op_success=true")
            lines.append(f"   outputs: {', '.join(bits)}")
        # Structured narrative fields
        if r["objectives"]:    lines.append(f"   objectives: {_truncate(r['objectives'], 300)}")
        if r["key_findings"]:  lines.append(f"   findings: {_truncate(r['key_findings'], 350)}")
        if r["next_steps"]:    lines.append(f"   next_steps: {_truncate(r['next_steps'], 280)}")
        if r["risks"]:         lines.append(f"   risks: {_truncate(r['risks'], 250)}")
        if r["description"]:   lines.append(f"   description: {_truncate(r['description'], 300)}")
        # Per-project reference links — the LLM should cite these when a
        # richer answer lives outside the dashboard.
        link_bits = []
        if r["confluence_url"]: link_bits.append(f"confluence=<{r['confluence_url']}>")
        if r["jira_url"]:       link_bits.append(f"jira=<{r['jira_url']}>")
        if r["repo_url"]:       link_bits.append(f"gitlab=<{r['repo_url']}>")
        if link_bits:
            lines.append(f"   links: {' | '.join(link_bits)}")

    return "\n".join(header + resource_block + lines)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/status")
def status(db: Session = Depends(get_db)):
    enabled = crud.get_setting(db, "llm_enabled", "false").lower() == "true"
    provider = crud.get_setting(db, "llm_provider", "openai")
    model = crud.get_setting(db, "llm_model", "")
    creds = _provider_credentials(db, provider)
    configured = bool(enabled and model and (creds["api_key"] or creds["base_url"]))
    return {
        "enabled": enabled,
        "provider": provider,
        "model": model,
        "configured": configured,
        "supported_providers": list(PROVIDERS.keys()),
    }


@router.post("/models")
async def list_models(body: ProviderProbeBody = ProviderProbeBody(),
                      db: Session = Depends(get_db),
                      _: models.User = Depends(require_admin)):
    """List models available at a provider endpoint.

    If request body is empty, uses the currently saved provider configuration.
    If body includes provider/base_url/api_key/cert_path, those override the
    saved values — letting the admin test an unsaved configuration live.
    """
    name = body.provider or crud.get_setting(db, "llm_provider", "openai")
    saved = _provider_credentials(db, name)
    creds = {
        "base_url": body.base_url if body.base_url is not None else saved["base_url"],
        "api_key": body.api_key if body.api_key is not None else saved["api_key"],
        "cert_path": body.cert_path if body.cert_path is not None else saved["cert_path"],
    }
    try:
        prov = build_provider(name, **creds)
        items = await prov.list_models()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, f"{name} returned HTTP {e.response.status_code}: {e.response.text[:200]}")
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Cannot reach {name} endpoint: {type(e).__name__}: {e}")
    except Exception as e:
        raise HTTPException(502, f"{name} model listing failed: {e}")
    return {"provider": name, "models": items}


@router.post("/test")
async def test_provider(body: ProviderTestBody,
                        db: Session = Depends(get_db),
                        _: models.User = Depends(require_admin)):
    """Send a tiny round-trip to verify a provider config works end-to-end.

    `provider` is required. `model` / `base_url` / `api_key` / `cert_path` may
    override saved values to test unsaved config. A 1-token "ping" is issued;
    we only care that the round-trip completes, not what the model says back.
    """
    name = (body.provider or "").lower()
    if name not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {body.provider!r}")

    saved = _provider_credentials(db, name)
    creds = {
        "base_url": body.base_url if body.base_url is not None else saved["base_url"],
        "api_key": body.api_key if body.api_key is not None else saved["api_key"],
        "cert_path": body.cert_path if body.cert_path is not None else saved["cert_path"],
    }
    model = body.model or crud.get_setting(db, "llm_model", "")
    if not model:
        return {"ok": False, "error": "No model selected — pick one and save before testing."}

    try:
        prov = build_provider(name, **creds)
        # Small token cap keeps the test cheap; we don't care about the text.
        reply = await prov.chat(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=16,
            timeout=30.0,
        )
        return {"ok": True, "provider": name, "model": model, "reply_preview": (reply or "")[:120]}
    except httpx.HTTPStatusError as e:
        body_preview = (e.response.text or "")[:200] if e.response is not None else ""
        return {"ok": False, "error": f"HTTP {e.response.status_code if e.response else '?'}: {body_preview}"}
    except httpx.HTTPError as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
    except ProviderError as e:
        return {"ok": False, "error": str(e)}
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


@router.get("/suggestions")
def suggestions(db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    projects = db.query(models.Project).all()
    # campaign_hub is stored as a plain string (was previously an Enum); guard
    # against either shape so this endpoint doesn't 500 during the transition.
    hubs = Counter(
        (p.campaign_hub.value if hasattr(p.campaign_hub, "value") else p.campaign_hub)
        for p in projects if p.campaign_hub
    )
    tools_counter: Counter = Counter()
    for p in projects:
        for t in p.tools:
            tools_counter[t.name] += 1
    top_hub = hubs.most_common(1)[0][0] if hubs else "Russia"
    top_tool = tools_counter.most_common(1)[0][0] if tools_counter else "Ghidra"
    return {
        "suggestions": [
            "Which campaign hub has the most projects, and what does its tech mix look like?",
            "Compare average time per stage across project types — where do we spend the most effort?",
            f"Which projects used {top_tool} and what were they targeting?",
            f"Summarise our {top_hub} work over the last year, including outcomes where closed.",
            "Which open projects have been running longest, and what's their current stage profile?",
            "What collaborators do we work with most, and which hubs do they support?",
        ]
    }


@router.post("/chat")
async def chat(data: schemas.ChatIn,
               db: Session = Depends(get_db),
               _: models.User = Depends(get_current_user)):
    enabled = crud.get_setting(db, "llm_enabled", "false").lower() == "true"
    model = crud.get_setting(db, "llm_model", "")
    if not enabled or not model:
        raise HTTPException(503, "LLM is not configured. An admin can enable it in Admin → LLM.")

    try:
        provider, provider_name = _resolve_provider_from_db(db)
    except Exception as e:
        raise HTTPException(503, f"Provider configuration error: {e}")

    context = _build_context(db)
    user_content = (
        "<context>\n"
        f"{context}\n"
        "</context>\n\n"
        f"User question: {data.message}"
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for m in data.history[-8:]:
        if m.get("role") in ("user", "assistant") and m.get("content"):
            messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_content})

    max_tokens = _max_tokens(db)

    try:
        raw = await provider.chat(model=model, messages=messages, max_tokens=max_tokens)
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            502,
            f"{provider_name} returned HTTP {e.response.status_code}. "
            f"{e.response.text[:200]}"
        )
    except httpx.HTTPError as e:
        raise HTTPException(
            502,
            f"{provider_name} endpoint unreachable ({type(e).__name__}). "
            f"Check URL, TLS, and network path."
        )
    except ProviderError as e:
        raise HTTPException(502, f"{provider_name} error: {e}")
    except Exception as e:
        raise HTTPException(502, f"{provider_name} unexpected error: {e}")

    text, charts, chart_errors = extract_charts(raw)
    cited = cited_project_ids(text)
    return {
        "answer": text,
        "charts": charts,
        "chart_errors": chart_errors,
        "cited_project_ids": cited,
        "provider": provider_name,
        "model": model,
    }
