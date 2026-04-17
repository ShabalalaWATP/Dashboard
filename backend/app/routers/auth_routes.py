from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from collections import defaultdict, deque
import time

from ..database import get_db
from ..auth import verify_password, create_token, get_current_user
from .. import models, schemas

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Login rate limit (in-process, per client IP)
#
# Defends against password-spraying / brute-force. A client gets up to
# LOGIN_MAX_ATTEMPTS failed attempts per LOGIN_WINDOW_SECONDS. Successful logins
# clear the counter for that IP. Resets naturally when entries expire.
#
# Intentionally in-process (no redis dep) — adequate for the expected scale
# (small internal team). If this ever runs with multiple uvicorn workers, each
# worker enforces its own limit; the effective cap becomes workers × cap,
# which is still far below brute-force-viable rates.
# ---------------------------------------------------------------------------
LOGIN_MAX_ATTEMPTS = 10
LOGIN_WINDOW_SECONDS = 300   # 5 minutes
_login_failures: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    """Best-effort client IP. X-Forwarded-For is honoured only because uvicorn
    is launched with --proxy-headers --forwarded-allow-ips "*" in run.sh.

    Normalises IPv6 address formats so the rate-limit bucket key is stable:
    strips surrounding brackets (some proxies emit "[2001:db8::1]") and
    lower-cases. Without this a client could vary formatting to rotate
    buckets and bypass the limit.
    """
    fwd = request.headers.get("x-forwarded-for", "")
    raw = fwd.split(",", 1)[0].strip() if fwd else (
        request.client.host if request.client else "unknown"
    )
    # IPv6 in a header is sometimes bracketed, e.g. "[::1]" or "[2001:db8::1]:443"
    if raw.startswith("["):
        # strip leading '[' and everything from the first ']' onward (which may
        # be followed by ":port")
        end = raw.find("]")
        raw = raw[1:end] if end > 0 else raw[1:]
    return raw.lower()


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    bucket = _login_failures[ip]
    # Drop entries that have aged out
    while bucket and now - bucket[0] > LOGIN_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= LOGIN_MAX_ATTEMPTS:
        oldest = bucket[0]
        retry_in = int(LOGIN_WINDOW_SECONDS - (now - oldest)) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Try again in {retry_in}s.",
            headers={"Retry-After": str(retry_in)},
        )


def _record_failure(ip: str) -> None:
    _login_failures[ip].append(time.monotonic())


def _clear_failures(ip: str) -> None:
    _login_failures.pop(ip, None)


@router.post("/login", response_model=schemas.TokenOut)
def login(request: Request,
          form: OAuth2PasswordRequestForm = Depends(),
          db: Session = Depends(get_db)):
    ip = _client_ip(request)
    _check_rate_limit(ip)
    user = db.query(models.User).filter(models.User.username == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        _record_failure(ip)
        # Generic message — don't leak whether the username exists
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _clear_failures(ip)
    token = create_token(user.username, user.role)
    return schemas.TokenOut(access_token=token, username=user.username, role=user.role)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
