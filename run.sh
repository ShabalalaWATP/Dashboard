#!/usr/bin/env bash
# Standalone launcher: build the frontend and serve it + API from a single FastAPI
# process on one port (default 8000). Air-gap safe once node_modules + pip wheels
# are cached locally.
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
PYTHON="${PYTHON:-python3}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_SEED="${SKIP_SEED:-0}"
# Uvicorn worker count. One worker already handles many concurrent users via
# async + a thread pool, so 1 is the right default for a small team on SQLite.
# Bump this (e.g. WORKERS=4) on a multi-core host if you see CPU saturation.
# NOTE: each worker has its own in-process caches (URL probe, token-param) —
# that's fine (each worker self-heals), not a correctness issue.
WORKERS="${WORKERS:-1}"
# Host to bind. 0.0.0.0 exposes the server on every interface so other users
# on the LAN / inside the VPC can reach it. Set to 127.0.0.1 to keep it local.
HOST="${HOST:-0.0.0.0}"

# ---- Python venv ---------------------------------------------------------
if [[ ! -d backend/.venv ]]; then
  echo "[run.sh] creating python venv"
  $PYTHON -m venv backend/.venv
fi
# shellcheck disable=SC1091
source backend/.venv/bin/activate
pip install --disable-pip-version-check -q -r backend/requirements.txt

# ---- Frontend build ------------------------------------------------------
if [[ "$SKIP_BUILD" != "1" ]]; then
  if [[ ! -d frontend/node_modules ]]; then
    echo "[run.sh] installing frontend deps"
    (cd frontend && npm install --no-audit --no-fund)
  fi
  echo "[run.sh] building frontend"
  (cd frontend && npm run build)
fi

# ---- Seed (only if DB not yet populated) --------------------------------
if [[ "$SKIP_SEED" != "1" ]]; then
  if [[ ! -f data/app.db ]] || [[ "$(sqlite3 data/app.db 'SELECT COUNT(*) FROM projects' 2>/dev/null || echo 0)" = "0" ]]; then
    echo "[run.sh] seeding demo data"
    python scripts/seed.py || true
  fi
fi

echo "[run.sh] starting on http://${HOST}:${PORT} (workers=${WORKERS})"
exec uvicorn app.main:app \
  --app-dir backend \
  --host "${HOST}" \
  --port "${PORT}" \
  --workers "${WORKERS}" \
  --proxy-headers \
  --forwarded-allow-ips "*"
