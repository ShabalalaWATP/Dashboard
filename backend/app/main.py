from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

from .database import Base, engine, SessionLocal
from . import models, migrate
from .auth import hash_password
from .config import DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASSWORD, FRONTEND_DIST, UPLOAD_DIR
from .routers import auth_routes, projects, settings_routes, users, llm_routes, analytics


def bootstrap():
    Base.metadata.create_all(bind=engine)
    migrate.run()
    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            db.add(models.User(
                username=DEFAULT_ADMIN_USER,
                password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
                role="admin",
            ))
            db.commit()
    finally:
        db.close()


bootstrap()

app = FastAPI(title="Cyber Research Portfolio", version="1.0.0")


# ---------------------------------------------------------------------------
# Security headers
#
# Applied to every response. Each header chosen to be safe with an internal
# SPA + JWT-in-Authorization-header setup:
#   X-Content-Type-Options: nosniff     stop MIME-type confusion attacks
#   X-Frame-Options: DENY                prevent click-jacking (no framing)
#   Referrer-Policy: no-referrer         don't leak our URLs to external sites
#   Permissions-Policy                   disable powerful APIs we never use
#   Strict-Transport-Security (HSTS)     applied only over HTTPS; harmless on http
# CSP is deliberately NOT set here — Tailwind's generated utility classes and
# Recharts' inline styles need 'unsafe-inline' which weakens CSP so much it's
# not worth the extra header. Add one in your reverse proxy if you need it.
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    )
    # Only advertise HSTS when the client actually used TLS — setting it on
    # plain http is ignored by browsers but noisy in dev proxy setups.
    if request.url.scheme == "https":
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response


# CORS — allow same-origin and vite dev (5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(projects.router)
app.include_router(settings_routes.router)
app.include_router(users.router)
app.include_router(llm_routes.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health():
    return {"ok": True}


# Uploaded assets (logos)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# Serve built frontend if present (production single-port setup)
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/")
    def root_index():
        idx = FRONTEND_DIST / "index.html"
        if idx.exists():
            return FileResponse(idx)
        return JSONResponse({"detail": "frontend not built"}, status_code=404)

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Return the SPA entry for any non-API, non-static path
        if full_path.startswith(("api/", "uploads/", "assets/")):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        idx = FRONTEND_DIST / "index.html"
        if idx.exists():
            return FileResponse(idx)
        return JSONResponse({"detail": "Not Found"}, status_code=404)
else:
    @app.get("/")
    def root_fallback():
        return {"ok": True, "detail": "API up. Frontend not built. Start vite dev or build the frontend."}
