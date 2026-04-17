"""Multi-provider LLM abstraction.

Four providers, all air-gap-friendly (every base URL overridable, every TLS
verification path configurable):

- openai     : any OpenAI-compatible /v1/chat/completions endpoint (OpenAI,
               OpenWebUI, Ollama OAI mode, vLLM, LM Studio, llama.cpp server).
               Path is auto-discovered: the provider cycles through common
               prefixes (``/v1/chat/completions``, ``/chat/completions``,
               ``/openai/v1/chat/completions``) until one responds, then
               caches the winner per base_url.
- litellm    : LiteLLM proxy — same wire format as openai, same URL cycling.
- anthropic  : Anthropic /v1/messages (Claude). Uses the current stable
               ``anthropic-version: 2023-06-01`` header and the paginated
               ``/v1/models?limit=N`` endpoint.
- gemini     : Google Generative Language API. Uses the ``x-goog-api-key``
               header (preferred over query-string auth), ``v1beta`` model
               path, and ``pageSize=1000`` on model listing.

All providers expose the same interface: chat(...) -> str and list_models().
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Tuple
import httpx


# ---------------------------------------------------------------------------
# System prompt — shared across providers
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an analytics assistant for an internal cyber research team.
You have read-only access to the team's full project portfolio via the <context>
block in the user turn. Each project row includes its full metadata: team,
dates, stages, stack, objectives, findings, next_steps, risks, and reference
links to Confluence / Jira / GitLab.

## Response format

Write responses in GitHub-flavoured markdown. Use:
- **bold** for emphasis
- bullet lists for enumeration
- pipe tables when comparing 3+ items across 2+ attributes
- fenced code blocks only when quoting verbatim project descriptions or JSON
- headings (###) sparingly, only for multi-section answers

Be terse. Prefer one well-chosen visualisation over three weak ones.

## Citations and links

Two kinds of citations are available — use BOTH where they apply:

1. **Project citations**: when you reference a specific project, cite it with
   `[[id]]` using its numeric id from the context. Example:
   "CRIMSON TIDE [[12]] ran for 217 days." The frontend turns `[[12]]` into a
   clickable chip that opens the project detail.

2. **Reference links**: when the answer benefits from deeper off-dashboard
   context (design docs, tickets, source), emit a standard markdown link to
   the project's Confluence / Jira / GitLab URL from its `links:` line:
   "See the [Confluence page](https://confluence.internal/…) for details."

Cite every project you name. Do NOT invent ids or URLs.

## Charts

If — and only if — a visualisation genuinely aids the answer, append one or more
chart blocks at the END of the response, after all prose:

<charts>
{"charts":[{"type":"bar|line|pie|donut","title":"Short title","data":[{"label":"X","value":123}]}]}
</charts>

Rules:
- Type must be exactly one of: bar, line, pie, donut
- Keep `data` to <= 12 entries. Aggregate or "Other"-bucket the rest.
- Use `bar` for categorical comparisons, `line` for time series, `pie`/`donut`
  only when parts sum to a meaningful whole (<= 6 slices).
- If two charts would help, emit two separate <charts> blocks.
- Do NOT produce a chart if the answer is a single number, a short list,
  or fundamentally non-numeric.

## When you don't know

The portfolio data has limits. For questions you can't answer from it
(policy, process, ongoing-incident status, anything outside the project
metadata), DO NOT just apologise. Instead:

1. Say briefly what you DO see in the data, if anything relevant.
2. Then direct the user to a specific team resource from the
   `TEAM RESOURCES` block at the top of the context. Render these as real
   markdown links so they're clickable, e.g.:
   "For the current process, see the [O3 Confluence Page](https://…) or
   [email the team](mailto:...)."
3. If none of the resources fit, suggest the most appropriate one (usually
   emailing the team).

Only say "I don't know" if genuinely nothing in context OR the TEAM RESOURCES
block applies.

## Do not

- Do not invent projects, stages, technologies, URLs, or collaborators that
  aren't in the context.
- Do not reproduce the entire portfolio table verbatim; summarise.
- Do not apologise or hedge excessively.
- Do not end with "let me know if you need more" — the user will ask.
"""


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------


class ProviderError(RuntimeError):
    pass


class LLMProvider(ABC):
    DEFAULT_BASE: str = ""

    def __init__(self, api_key: str = "", base_url: str = "", cert_path: str = ""):
        self.api_key = api_key or ""
        self.base_url = (base_url or "").rstrip("/") or self.DEFAULT_BASE
        self.cert_path = (cert_path or "").strip()

    @property
    def verify(self):
        """httpx `verify` parameter: True → system CAs, or a path → custom bundle.
        verify=False is never offered."""
        return self.cert_path if self.cert_path else True

    @abstractmethod
    async def chat(self, model: str, messages: List[Dict], max_tokens: int,
                   timeout: float = 120.0) -> str: ...

    @abstractmethod
    async def list_models(self, timeout: float = 30.0) -> List[str]: ...


# ---------------------------------------------------------------------------
# OpenAI-compatible (also used by LiteLLM)
# ---------------------------------------------------------------------------


# Module-level caches so each deployment only probes once per base URL.
# Keyed by normalised base_url so cert/key changes don't bust the cache.
_OAI_CHAT_CACHE: Dict[str, str] = {}
_OAI_MODELS_CACHE: Dict[str, str] = {}
# Which completion-token parameter the endpoint accepts. Newer OpenAI models
# expect `max_completion_tokens`; older compat servers still want `max_tokens`.
# We auto-detect on first call and remember per base_url.
_OAI_TOKEN_PARAM_CACHE: Dict[str, str] = {}


_OAI_SUFFIXES_TO_STRIP = [
    "/v1/chat/completions", "/chat/completions",
    "/v1/chat/",           "/chat/",
    "/v1/chat",            "/chat",
    "/v1/models",          "/models",
    "/v1/",                "/v1",
]


def _strip_oai_suffix(base: str) -> str:
    """Normalise a user-entered base URL by removing any OpenAI API path
    components they may have typed. ``http://host/v1/chat/completions`` →
    ``http://host``."""
    b = base.rstrip("/")
    # Loop, not a single match, in case the user typed ``host/v1/chat/``:
    # we strip one suffix and try again until the URL stabilises.
    while True:
        shorter = b
        for suf in _OAI_SUFFIXES_TO_STRIP:
            if shorter.endswith(suf):
                shorter = shorter[: -len(suf)].rstrip("/")
                break
        if shorter == b:
            return b
        b = shorter


class OpenAIProvider(LLMProvider):
    DEFAULT_BASE = "https://api.openai.com"

    def _root(self) -> str:
        return _strip_oai_suffix(self.base_url)

    def _chat_candidates(self) -> List[str]:
        r = self._root()
        return [
            f"{r}/v1/chat/completions",       # OpenAI, vLLM, LiteLLM, OpenWebUI OAI mode
            f"{r}/chat/completions",          # bare-path proxies
            f"{r}/openai/v1/chat/completions",# /openai-prefixed gateways
        ]

    def _models_candidates(self) -> List[str]:
        r = self._root()
        return [
            f"{r}/v1/models",
            f"{r}/models",
            f"{r}/openai/v1/models",
        ]

    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    async def _cycle(
        self,
        method: str,
        candidates: List[str],
        cache: Dict[str, str],
        *,
        headers: Dict[str, str],
        json_body: Optional[dict] = None,
        timeout: float,
    ) -> Tuple[str, dict]:
        """Send a request to the first candidate URL that doesn't 404/405.
        Cache the winner so subsequent calls skip the probe. Returns (url, json)."""
        cached = cache.get(self.base_url)
        ordered = (
            [cached] + [u for u in candidates if u != cached]
            if cached else list(candidates)
        )

        last_err: Optional[str] = None
        fallback_exc: Optional[BaseException] = None   # last 404/405
        auth_exc: Optional[BaseException] = None       # first 401/403 (more informative)
        async with httpx.AsyncClient(timeout=timeout, verify=self.verify) as client:
            for url in ordered:
                try:
                    if method == "GET":
                        resp = await client.get(url, headers=headers)
                    else:
                        resp = await client.post(url, headers=headers, json=json_body)
                except (httpx.ConnectError, httpx.ConnectTimeout):
                    # All candidates share host/port — a connect failure means
                    # the whole endpoint is unreachable; fail fast.
                    raise

                # Path-discovery signals: cycle past and track the "best" error
                # to surface if every candidate fails. 401/403 is preferred over
                # 404/405 because it tells the operator the path exists but
                # auth is the real issue.
                if resp.status_code in (401, 403, 404, 405):
                    last_err = f"HTTP {resp.status_code} at {url}"
                    try:
                        resp.raise_for_status()
                    except httpx.HTTPStatusError as e:
                        if resp.status_code in (401, 403) and auth_exc is None:
                            auth_exc = e
                        else:
                            fallback_exc = e
                    continue

                # 4xx (not listed above) / 5xx: not a path issue — surface
                # directly so the operator can debug. No cache write on error.
                try:
                    resp.raise_for_status()
                except httpx.HTTPStatusError:
                    raise

                try:
                    data = resp.json()
                except ValueError:
                    # 200 but not JSON — almost certainly an HTML SPA fallback
                    # from a reverse proxy hitting the wrong route. Try next.
                    last_err = f"non-JSON response at {url}"
                    continue

                # Only a genuine 2xx + valid JSON caches the URL.
                cache[self.base_url] = url
                return url, data

        # Every candidate failed. Prefer an auth error (actionable) over a
        # 404 (ambiguous — could be wrong path, could be path missing globally).
        if auth_exc is not None:
            raise auth_exc
        if fallback_exc is not None:
            raise fallback_exc

        raise ProviderError(
            f"No working OpenAI-compatible path found under {self._root()!r}. "
            f"Tried {', '.join(ordered)}. Last error: {last_err or 'unknown'}."
        )

    async def chat(self, model, messages, max_tokens, timeout=120.0):
        # Newer OpenAI reasoning models require `max_completion_tokens`; older
        # compat servers only accept `max_tokens`. Try the preferred param
        # (cached per base URL, or max_completion_tokens by default), and only
        # retry with the alternate if the 400 actually names the token param.
        # Blind retries on any 400 would mask real errors (e.g. "max_tokens is
        # too large for this model") behind a misleading "unsupported param"
        # error from the second attempt.
        preferred = _OAI_TOKEN_PARAM_CACHE.get(self.base_url, "max_completion_tokens")
        fallback = "max_tokens" if preferred == "max_completion_tokens" else "max_completion_tokens"
        attempts: List[str] = [preferred]
        if fallback != preferred:
            attempts.append(fallback)

        first_exc: Optional[httpx.HTTPStatusError] = None
        for i, param in enumerate(attempts):
            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.2,
                "stream": False,
                param: max_tokens,
            }
            try:
                url, data = await self._cycle(
                    "POST", self._chat_candidates(), _OAI_CHAT_CACHE,
                    headers=self._headers(), json_body=payload, timeout=timeout,
                )
            except httpx.HTTPStatusError as e:
                if first_exc is None:
                    first_exc = e   # first error is usually the most informative
                body = (e.response.text or "").lower() if e.response is not None else ""
                is_param_complaint = (
                    "unsupported parameter" in body
                    or "unrecognized" in body
                    or "unknown parameter" in body
                    or ("is not supported" in body and param in body)
                )
                # Only swap the token param when the error body actually names
                # it. A "max_tokens too large" error, for instance, is NOT a
                # param-name complaint — retrying with max_completion_tokens
                # would just mask that real problem.
                if (e.response is not None
                        and e.response.status_code == 400
                        and is_param_complaint
                        and i < len(attempts) - 1):
                    _OAI_TOKEN_PARAM_CACHE.pop(self.base_url, None)
                    continue
                # Non-retryable (or out of attempts): surface the FIRST error,
                # which is usually more informative than the second swap's
                # complaint.
                raise first_exc
            # Success — remember which param this endpoint wants
            _OAI_TOKEN_PARAM_CACHE[self.base_url] = param
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as e:
                raise ProviderError(f"Unexpected response shape from {url}: {data!r}") from e

        # Exhausted all attempts (swap-and-retry path)
        if first_exc is not None:
            raise first_exc
        raise ProviderError("chat completion failed with no further info")

    async def list_models(self, timeout=30.0):
        url, data = await self._cycle(
            "GET", self._models_candidates(), _OAI_MODELS_CACHE,
            headers=self._headers(), timeout=timeout,
        )
        items = data.get("data") or data.get("models") or []
        return sorted({
            (it.get("id") or it.get("name") or "") for it in items
            if (it.get("id") or it.get("name"))
        })


class LiteLLMProvider(OpenAIProvider):
    """LiteLLM proxy exposes an OpenAI-compatible surface. Benefits from the
    same URL cycling as OpenAIProvider (which is important for operators who
    mount LiteLLM at a sub-path like /litellm)."""
    DEFAULT_BASE = "http://localhost:4000"


# ---------------------------------------------------------------------------
# Anthropic (Claude) — Messages API
# ---------------------------------------------------------------------------


class AnthropicProvider(LLMProvider):
    DEFAULT_BASE = "https://api.anthropic.com"
    API_VERSION = "2023-06-01"  # current stable

    def _headers(self) -> Dict[str, str]:
        h = {
            "Content-Type": "application/json",
            "anthropic-version": self.API_VERSION,
        }
        if self.api_key:
            h["x-api-key"] = self.api_key
        return h

    async def chat(self, model, messages, max_tokens, timeout=120.0):
        # Anthropic carries system prompt as a top-level field, not a role.
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        chat_msgs = [
            {"role": m["role"], "content": m["content"]}
            for m in messages if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        payload: dict = {
            "model": model,
            "messages": chat_msgs,
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }
        if system_parts:
            payload["system"] = "\n\n".join(system_parts)

        url = f"{self.base_url}/v1/messages"
        async with httpx.AsyncClient(timeout=timeout, verify=self.verify) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

        # Response: {"content": [{"type": "text", "text": "..."}, ...], "stop_reason": ...}
        blocks = data.get("content", [])
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        if not text:
            reason = data.get("stop_reason", "unknown")
            raise ProviderError(f"Empty Anthropic response (stop_reason={reason}): {data!r}")
        return text

    async def list_models(self, timeout=30.0):
        """Paginate through /v1/models using the documented cursor (`after_id`).
        Anthropic returns at most 1000 per page."""
        url = f"{self.base_url}/v1/models"
        headers = self._headers()
        ids: set[str] = set()
        after_id: Optional[str] = None

        async with httpx.AsyncClient(timeout=timeout, verify=self.verify) as client:
            while True:
                params = {"limit": 1000}
                if after_id:
                    params["after_id"] = after_id
                resp = await client.get(url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                batch = data.get("data") or []
                for it in batch:
                    mid = it.get("id")
                    if mid:
                        ids.add(mid)
                if not data.get("has_more"):
                    break
                after_id = data.get("last_id") or (batch[-1].get("id") if batch else None)
                if not after_id:
                    break
        return sorted(ids)


# ---------------------------------------------------------------------------
# Google Gemini — Generative Language API
# ---------------------------------------------------------------------------


class GeminiProvider(LLMProvider):
    DEFAULT_BASE = "https://generativelanguage.googleapis.com"
    API_VERSION = "v1beta"  # current de-facto — v1 is stable but v1beta has the features

    def _headers(self) -> Dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            # Header-based auth is preferred over the ?key=X query param since
            # it doesn't leak the key into server access logs.
            h["x-goog-api-key"] = self.api_key
        return h

    async def chat(self, model, messages, max_tokens, timeout=120.0):
        system_parts = [m["content"] for m in messages if m.get("role") == "system"]
        contents: list[dict] = []
        for m in messages:
            r = m.get("role")
            if r == "user":
                contents.append({"role": "user", "parts": [{"text": m["content"]}]})
            elif r == "assistant":
                contents.append({"role": "model", "parts": [{"text": m["content"]}]})

        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

        url = f"{self.base_url}/{self.API_VERSION}/models/{model}:generateContent"
        async with httpx.AsyncClient(timeout=timeout, verify=self.verify) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates") or []
        if not candidates:
            # When prompt is blocked the response has `promptFeedback` instead
            feedback = data.get("promptFeedback", {})
            reason = feedback.get("blockReason", "no candidates")
            raise ProviderError(f"Gemini returned no candidates ({reason}): {data!r}")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts if p.get("text"))
        if not text:
            reason = candidates[0].get("finishReason", "unknown")
            raise ProviderError(f"Empty Gemini content (finishReason={reason})")
        return text

    async def list_models(self, timeout=30.0):
        """Paginate /v1beta/models with pageSize=1000. Filter to models that
        actually support generateContent — Google exposes embedding models
        and tuned-model adapters via the same endpoint."""
        url = f"{self.base_url}/{self.API_VERSION}/models"
        headers = self._headers()
        names: set[str] = set()
        page_token: Optional[str] = None

        async with httpx.AsyncClient(timeout=timeout, verify=self.verify) as client:
            while True:
                params = {"pageSize": 1000}
                if page_token:
                    params["pageToken"] = page_token
                resp = await client.get(url, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                for it in data.get("models", []):
                    name = it.get("name", "")
                    if name.startswith("models/"):
                        name = name[len("models/"):]
                    methods = it.get("supportedGenerationMethods", [])
                    if not methods or "generateContent" in methods:
                        names.add(name)
                page_token = data.get("nextPageToken")
                if not page_token:
                    break
        return sorted(names)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

PROVIDERS = {
    "openai":    OpenAIProvider,
    "litellm":   LiteLLMProvider,
    "anthropic": AnthropicProvider,
    "gemini":    GeminiProvider,
}


def build_provider(name: str, api_key: str = "", base_url: str = "",
                   cert_path: str = "") -> LLMProvider:
    cls = PROVIDERS.get((name or "openai").lower())
    if not cls:
        raise ValueError(f"Unknown LLM provider: {name!r}")
    return cls(api_key=api_key, base_url=base_url, cert_path=cert_path)


def reset_url_cache() -> None:
    """Wipe the OpenAI URL probe cache AND the token-param cache. Called after
    changing base URL / cert path so the next request re-discovers both the
    right path and the right completion-token param for the (possibly new)
    server behind that URL."""
    _OAI_CHAT_CACHE.clear()
    _OAI_MODELS_CACHE.clear()
    _OAI_TOKEN_PARAM_CACHE.clear()
