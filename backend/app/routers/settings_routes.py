from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import json
from pathlib import Path
from typing import List

from ..database import get_db
from ..auth import require_admin
from .. import models, schemas, crud
from ..config import UPLOAD_DIR

router = APIRouter(prefix="/api/settings", tags=["settings"])


PUBLIC_KEYS = {
    "classification_level", "classification_text",
    "about_team", "app_title", "team_name",
    # Admin-editable terminology — defaults can be renamed to anything
    # (e.g., "Mission Areas" instead of "Campaigns", or "Retained Findings"
    # instead of "HS Equities").
    "label_campaigns", "label_campaign",
    "label_equities",
    # "About the Team" footer — heading, links, email, footer tagline.
    # Every link slot has a description that appears on the big card alongside
    # its label; the Email Us card has its own description too.
    "footer_heading", "footer_tagline",
    "footer_link_1_label", "footer_link_1_url", "footer_link_1_description",
    "footer_link_2_label", "footer_link_2_url", "footer_link_2_description",
    "footer_link_3_label", "footer_link_3_url", "footer_link_3_description",
    "team_email", "team_email_subject", "team_email_description",
}

LLM_COMMON = {"llm_enabled", "llm_provider", "llm_model", "llm_max_tokens"}
LLM_PROVIDER_KEYS = {
    # openai-compatible
    "llm_openai_base_url", "llm_openai_api_key", "llm_openai_cert_path",
    # litellm proxy
    "llm_litellm_base_url", "llm_litellm_api_key", "llm_litellm_cert_path",
    # anthropic
    "llm_anthropic_base_url", "llm_anthropic_api_key", "llm_anthropic_cert_path",
    # google gemini
    "llm_gemini_base_url", "llm_gemini_api_key", "llm_gemini_cert_path",
}
# Legacy single-endpoint fields — kept so older deployments keep working;
# the admin UI no longer exposes them directly.
LLM_LEGACY = {"llm_base_url", "llm_api_key"}

LLM_KEYS = LLM_COMMON | LLM_PROVIDER_KEYS | LLM_LEGACY

# Admin-editable taxonomy lists (stored as JSON strings in the settings table).
# Order matters — used as the display order in the Admin → Catalogs UI.
CATALOG_NAMES = [
    "project_types",
    "target_technologies",
    "hubs", "technologies", "tools", "os", "languages",
    "architectures", "collaborators", "customers",
    "outcomes",
]
CATALOG_KEYS = {f"catalog_{n}" for n in CATALOG_NAMES}

ADMIN_KEYS = LLM_KEYS | PUBLIC_KEYS | CATALOG_KEYS

SECRET_KEY_SUFFIX = "_api_key"


@router.get("/public")
def get_public_settings(db: Session = Depends(get_db)):
    return {k: crud.get_setting(db, k, _default_for(k)) for k in PUBLIC_KEYS}


@router.get("/all")
def get_all_settings(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    """Return all admin-visible settings. Every *_api_key field is returned as
    an empty string plus an `_api_key_set` flag, so the UI can show whether a
    key is configured without ever sending it back to the browser."""
    out: dict = {}
    for key in ADMIN_KEYS:
        value = crud.get_setting(db, key, _default_for(key))
        if key.endswith(SECRET_KEY_SUFFIX):
            out[f"{key}_set"] = bool(value)
            out[key] = ""  # never echo
        else:
            out[key] = value
    return out


def _validate_cert_path(path: str) -> None:
    """Refuse obviously dodgy cert paths. The field is admin-only and fed to
    httpx's `verify=` parameter, so an attacker who is already an admin could
    point it at /etc/shadow etc. httpx would fail to parse it as a PEM and
    raise, but the existence-vs-nonexistence signal alone is an oracle. We
    cheaply reject empty strings (allowed — means use system CAs), relative
    paths (ambiguous in a daemon), and anything with traversal segments."""
    if not path:
        return
    p = Path(path)
    # Reject traversal attempts even if the final string doesn't contain ".."
    # after resolution — we want to block the *intent*, not just the result.
    if ".." in p.parts:
        raise HTTPException(400, "cert_path must not contain '..'")
    if not p.is_absolute():
        raise HTTPException(400, "cert_path must be an absolute path")
    # Must exist and be a regular file; a directory or symlink to /etc/shadow
    # would be refused here because httpx wants a PEM file anyway.
    if not p.is_file():
        raise HTTPException(400, f"cert_path {path!r} does not exist or is not a regular file")


@router.post("/update")
def update_settings(payload: dict,
                    db: Session = Depends(get_db),
                    _: models.User = Depends(require_admin)):
    """Accepts any subset of ADMIN_KEYS. For *_api_key fields, an empty string
    is treated as "leave existing value" (so the UI can safely submit the form
    without re-entering the key). Pass the literal string `__clear__` to wipe
    a key."""
    touched_urls = False
    for key, value in payload.items():
        if key not in ADMIN_KEYS:
            continue
        str_val = "" if value is None else str(value)
        if key.endswith(SECRET_KEY_SUFFIX):
            if str_val == "":
                continue  # preserve existing
            if str_val == "__clear__":
                crud.set_setting(db, key, "")
                continue
        if key.endswith("_cert_path"):
            _validate_cert_path(str_val)
        if "_base_url" in key or "_cert_path" in key:
            touched_urls = True
        crud.set_setting(db, key, str_val)

    # When any endpoint URL or CA bundle changes, invalidate the URL probe
    # cache so the next request re-discovers the right path.
    if touched_urls:
        from ..llm_providers import reset_url_cache
        reset_url_cache()
    return {"ok": True}


@router.get("/catalogs")
def get_catalogs(db: Session = Depends(get_db)):
    """Public: return all admin-editable taxonomy lists. Used by project
    forms for autocomplete. Write-ins are still accepted; catalogs are
    suggestions, not validation."""
    out: dict[str, List[str]] = {}
    for name in CATALOG_NAMES:
        raw = crud.get_setting(db, f"catalog_{name}", "")
        try:
            parsed = json.loads(raw) if raw else []
            if not isinstance(parsed, list):
                parsed = []
        except (json.JSONDecodeError, TypeError):
            parsed = []
        # de-dupe while preserving order
        seen: set[str] = set()
        cleaned: List[str] = []
        for item in parsed:
            s = str(item).strip()
            if s and s not in seen:
                seen.add(s)
                cleaned.append(s)
        out[name] = cleaned
    return {"catalogs": out}


@router.post("/catalogs")
def update_catalogs(payload: schemas.CatalogUpdate,
                    db: Session = Depends(get_db),
                    _: models.User = Depends(require_admin)):
    """Replace the stored value for any subset of taxonomy catalogs."""
    for name, items in payload.catalogs.items():
        if name not in CATALOG_NAMES:
            continue
        cleaned: List[str] = []
        seen: set[str] = set()
        for it in (items or []):
            s = str(it).strip()
            if s and s not in seen:
                seen.add(s)
                cleaned.append(s)
        crud.set_setting(db, f"catalog_{name}", json.dumps(cleaned))
    return {"ok": True}


# Upload limits.
# - MAX_UPLOAD_BYTES  5 MB is plenty for a logo; anything bigger is either
#                     over-sized art or an attempt to fill the disk.
# - ALLOWED_EXTS      SVG intentionally NOT allowed. SVGs are XML and can
#                     embed <script>, event handlers, or xlink:href javascript:
#                     URLs. Rasters (png/jpg/webp) don't carry executable
#                     payload a browser will run.
# - MAGIC_BYTES       Minimum sniff so attackers can't rename `evil.html` →
#                     `logo.png` and sneak past the extension check.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_EXTS = (".png", ".jpg", ".jpeg", ".webp")
MAGIC_BYTES = {
    ".png":  [b"\x89PNG\r\n\x1a\n"],
    ".jpg":  [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".webp": [b"RIFF"],   # RIFF....WEBP
}


@router.post("/upload/{kind}")
async def upload_logo(kind: str,
                      file: UploadFile = File(...),
                      _: models.User = Depends(require_admin)):
    if kind not in ("team-logo", "hero-logo"):
        raise HTTPException(400, "Invalid kind")
    ext = Path(file.filename or "").suffix.lower() or ".png"
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported image type. Allowed: {', '.join(ALLOWED_EXTS)}")

    # Stream into memory with a cap — reading the whole blob before caring
    # about size would let an attacker OOM the server with a big upload. The
    # 1 MiB chunk size is a compromise between memory pressure and syscall
    # overhead; the cap itself is what matters.
    data = bytearray()
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File too large. Max {MAX_UPLOAD_BYTES // (1024*1024)} MB.")
    if not data:
        raise HTTPException(400, "Empty file")

    # Magic-byte sniff: confirms the file actually matches its claimed
    # extension. Doesn't stop every malformed image but filters the lazy
    # "rename HTML to PNG" attack cheaply.
    magics = MAGIC_BYTES.get(ext, [])
    if magics and not any(bytes(data[:len(m)]) == m for m in magics):
        raise HTTPException(400, f"File contents do not match {ext} format")

    dest = UPLOAD_DIR / f"{kind}{ext}"
    # clear prior files of this kind
    for p in UPLOAD_DIR.glob(f"{kind}.*"):
        try:
            p.unlink()
        except OSError:
            pass
    dest.write_bytes(bytes(data))
    return {"ok": True, "path": f"/uploads/{dest.name}"}


def _asset_handler(kind: str):
    """Common body for GET and HEAD on /asset/{kind}. Keeping it as one
    function with two decorator-distinct wrappers means FastAPI generates
    unique operation_ids for OpenAPI (no more "Duplicate Operation ID"
    warning on startup)."""
    if kind not in ("team-logo", "hero-logo"):
        raise HTTPException(400, "Invalid kind")
    for p in sorted(UPLOAD_DIR.glob(f"{kind}.*")):
        return FileResponse(p)
    raise HTTPException(404, "Not found")


@router.get("/asset/{kind}")
def get_asset(kind: str):
    """Serve the named logo image."""
    return _asset_handler(kind)


@router.head("/asset/{kind}", include_in_schema=False)
def head_asset(kind: str):
    """HEAD variant so the frontend can probe for existence without
    downloading the whole image."""
    return _asset_handler(kind)


def _default_for(key: str) -> str:
    defaults = {
        "classification_level": "OFFICIAL",
        "classification_text": "OFFICIAL",
        "about_team": (
            "The Cyber Research Team delivers deep technical analysis across "
            "reverse engineering, vulnerability research, and applied exploit "
            "development in support of national security objectives."
        ),
        "app_title": "Cyber Research Portfolio",
        "team_name": "Cyber Research Team",
        "llm_enabled": "false",
        "llm_provider": "openai",
        "llm_model": "",
        "llm_max_tokens": "16384",
        "label_campaigns": "Campaigns",
        "label_campaign": "Campaign",
        "label_equities": "HS Equities",
        "footer_heading": "About the Team",
        "footer_tagline": "Internal Use",
        "footer_link_1_label": "The Team Front Door",
        "footer_link_1_url": "",
        "footer_link_1_description":
            "The team's homepage — daily announcements, meeting schedules, and rota.",
        "footer_link_2_label": "Cyber Research Team Confluence",
        "footer_link_2_url": "",
        "footer_link_2_description":
            "Deep technical documentation: project archives, tradecraft notes, and writeups.",
        "footer_link_3_label": "O3 Confluence Page",
        "footer_link_3_url": "",
        "footer_link_3_description":
            "Where the Cyber Research Team sits in O3 — org chart, remit, and key stakeholders.",
        "team_email": "",
        "team_email_subject": "Cyber Research Team enquiry",
        "team_email_description":
            "For questions, requests, or anything else that isn't covered on the pages above.",
    }
    return defaults.get(key, "")
