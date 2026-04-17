from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import DATABASE_URL

# Pool sized for concurrent API requests. SQLite itself serialises writes
# internally (WAL mode — set below), so a modest pool with room to grow is the
# right balance: pool_size covers steady-state, max_overflow absorbs bursts.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    future=True,
)


# Per-connection PRAGMAs. Applied once when SQLAlchemy opens a new connection
# and reused for the life of that connection. These are the key knobs that
# make SQLite safe for many concurrent readers + one writer:
#   journal_mode=WAL   readers no longer block on a writer, and a writer no
#                       longer blocks readers. Required for multi-user access.
#   synchronous=NORMAL WAL-appropriate durability; FULL is overkill for WAL
#                       and halves write throughput.
#   busy_timeout=5000  5-second wait on lock contention before raising
#                       "database is locked" — covers brief write bursts.
#   foreign_keys=ON    enforce cascades/constraints (off by default in SQLite)
@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _record):
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA busy_timeout=5000")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
