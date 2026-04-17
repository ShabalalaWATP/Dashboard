# Multi-stage build: compile frontend then bundle with the FastAPI backend.
# Produces a single image that serves everything on one port.

# ---- Stage 1: frontend build ----
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package.json
WORKDIR /web/frontend
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: runtime ----
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY scripts/ scripts/
COPY --from=web /web/frontend/dist frontend/dist

RUN mkdir -p data

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
