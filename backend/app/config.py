from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True, parents=True)

UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

DB_PATH = DATA_DIR / "app.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# JWT — if no secret provided we generate one and persist it so tokens survive
# restarts. The file is chmod 0600 on POSIX so it's readable only by the
# account running the server (Windows NTFS doesn't honour POSIX bits, so the
# chmod is a silent no-op there — fine for local dev).
SECRET_FILE = DATA_DIR / ".jwt_secret"
if not SECRET_FILE.exists():
    SECRET_FILE.write_text(os.urandom(32).hex())
try:
    # 0o600 = owner read/write only. Refresh on every startup so a file that
    # was accidentally created with looser bits in an older version of the app
    # gets tightened automatically.
    os.chmod(SECRET_FILE, 0o600)
except (OSError, NotImplementedError):
    pass
JWT_SECRET = os.environ.get("JWT_SECRET") or SECRET_FILE.read_text().strip()
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 12

# Static files (frontend build) served from here in production
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

# Default admin
DEFAULT_ADMIN_USER = "admin"
DEFAULT_ADMIN_PASSWORD = "ChangeMe!123"
