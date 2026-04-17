"""Chart-block parser + citation extractor, shared across providers.

The actual chat dispatch lives in `llm_providers.py`. This module is kept as a
thin utility layer.
"""
from __future__ import annotations
import json
import re
from typing import List, Tuple, Optional

# Re-export the system prompt so older imports still work
from .llm_providers import SYSTEM_PROMPT  # noqa: F401


_CHART_RE = re.compile(r"<charts>\s*(.*?)\s*</charts>", re.DOTALL)


def _validate_chart(c: dict) -> Optional[dict]:
    if not isinstance(c, dict):
        return None
    t = str(c.get("type", "")).lower().strip()
    if t not in ("bar", "line", "pie", "donut"):
        return None
    title = str(c.get("title", "")).strip() or "Chart"
    data = c.get("data") or []
    if not isinstance(data, list) or not data:
        return None
    clean_data = []
    for row in data[:12]:
        if not isinstance(row, dict):
            continue
        label = row.get("label") if "label" in row else row.get("name")
        value = row.get("value")
        if label is None or value is None:
            continue
        try:
            clean_data.append({"label": str(label), "value": float(value)})
        except (TypeError, ValueError):
            continue
    if not clean_data:
        return None
    return {"type": t, "title": title, "data": clean_data}


def extract_charts(text: str) -> Tuple[str, List[dict], List[str]]:
    """Return (cleaned_text, valid_charts, parse_errors)."""
    charts: List[dict] = []
    errors: List[str] = []
    for idx, m in enumerate(_CHART_RE.finditer(text), 1):
        raw = m.group(1)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            errors.append(f"chart block #{idx}: invalid JSON ({e.msg})")
            continue
        items = parsed.get("charts") if isinstance(parsed, dict) else None
        if not isinstance(items, list):
            errors.append(f"chart block #{idx}: missing 'charts' array")
            continue
        for j, c in enumerate(items, 1):
            v = _validate_chart(c)
            if v:
                charts.append(v)
            else:
                errors.append(f"chart block #{idx} item #{j}: unrecognised shape")
    cleaned = _CHART_RE.sub("", text).strip()
    return cleaned, charts, errors


CITATION_RE = re.compile(r"\[\[(\d+)\]\]")


def cited_project_ids(text: str) -> List[int]:
    return sorted({int(m.group(1)) for m in CITATION_RE.finditer(text)})
