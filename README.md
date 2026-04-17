# Cyber Research Portfolio

Internal, air-gapped analytics dashboard for a cyber research team.
Dark-mode SOC / threat-intel console aesthetic. Everything vendored locally —
no CDNs, no Google Fonts, no outbound calls at runtime except to whatever
LLM endpoint an admin explicitly configures.

## Stack

| Layer    | Tech                                                              |
|----------|-------------------------------------------------------------------|
| Frontend | React 18 · Vite · TypeScript · Tailwind · Recharts · lucide-react |
| Backend  | FastAPI · SQLAlchemy · SQLite (WAL) · JWT + bcrypt                |
| Deploy   | Single port (FastAPI serves the built SPA) · Docker Compose · `run.sh` |

## Quick start

### Standalone (Linux / WSL / macOS)

```bash
./run.sh                   # builds frontend, seeds DB, starts on :8000
```

Environment knobs:

| Var           | Default   | Purpose                                       |
|---------------|-----------|-----------------------------------------------|
| `PORT`        | `8000`    | TCP port to bind                              |
| `HOST`        | `0.0.0.0` | Interface to bind (`127.0.0.1` = local only)  |
| `WORKERS`     | `1`       | Uvicorn worker count (bump for heavy load)    |
| `SKIP_BUILD`  | `0`       | `1` = reuse existing `frontend/dist`          |
| `SKIP_SEED`   | `0`       | `1` = never auto-seed                         |
| `JWT_SECRET`  | auto      | Override the persisted secret at `data/.jwt_secret` |
| `PYTHON`      | `python3` | Python interpreter used to bootstrap the venv |

### Docker

```bash
docker compose build
docker compose up          # http://localhost:8000
```

Once `node:20-alpine` and `python:3.11-slim` are cached on a build host,
`docker compose build` is fully offline.

### Dev mode

Two processes; vite proxies `/api` and `/uploads` to the backend:

```bash
# Terminal 1
cd backend && python3 -m venv .venv && source .venv/bin/activate \
  && pip install -r requirements.txt \
  && uvicorn app.main:app --app-dir . --reload --port 8000

# Terminal 2
cd frontend && npm install && npm run dev   # http://localhost:5173
```

---

## Deploying to an air-gapped Ubuntu VM

The full pipeline: download everything you need on a host with internet, move
the bundle to the air-gapped VM, install.

### 1. On a machine with internet — build an offline bundle

Install matching Ubuntu-compatible toolchains (Python 3.11+, Node 20+). Then:

```bash
# Clone the repo and fetch all runtime dependencies
git clone <repo> Dashboard && cd Dashboard

# --- Python wheels ---
python3 -m venv _offline_venv
source _offline_venv/bin/activate
pip install --upgrade pip wheel
mkdir -p offline/wheels
pip download -r backend/requirements.txt -d offline/wheels --platform manylinux2014_x86_64 \
    --python-version 3.11 --only-binary=:all:
# pure-python fallbacks for packages without a manylinux wheel:
pip download -r backend/requirements.txt -d offline/wheels

# --- Node modules + built frontend ---
cd frontend
npm ci                          # exact lockfile install
npm run build                   # produces frontend/dist/
cd ..

# --- (Optional) bundle fonts for offline use ---
# Drop Inter + JetBrains Mono .woff2 files into frontend/public/fonts/
# before building, then rebuild. Names are documented in the README.txt there.
# Without them the app falls back to system UI fonts — totally fine.

# --- Tarball the lot ---
tar --exclude=_offline_venv \
    --exclude=backend/.venv \
    --exclude=data \
    --exclude=.git \
    --exclude=node_modules/.cache \
    -czf dashboard-offline.tgz .
```

`dashboard-offline.tgz` now contains: source, built frontend, Python wheels,
and `frontend/node_modules`. That's everything the VM needs.

### 2. Transfer to the air-gapped VM

USB stick, internal FTP, shared volume — whatever your process allows.

### 3. On the air-gapped Ubuntu VM — one-time setup

```bash
# Base packages (the VM must already have these installed from the Ubuntu
# mirror; this list is what apt would normally fetch). Nothing in steps
# below requires apt once these are in place.
sudo apt-get install -y python3 python3-venv python3-dev build-essential sqlite3

# Unpack
sudo mkdir -p /opt/dashboard && sudo chown "$USER":"$USER" /opt/dashboard
tar -xzf dashboard-offline.tgz -C /opt/dashboard
cd /opt/dashboard

# Create venv and install from the wheels we shipped
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install --no-index --find-links offline/wheels -r backend/requirements.txt

# First launch: skip build (frontend is already in frontend/dist), seed DB
SKIP_BUILD=1 ./run.sh
```

On first launch:
- Creates `data/app.db`, `data/uploads/`, `data/.jwt_secret` (chmod 600)
- Seeds 45 demo projects (skip with `SKIP_SEED=1`)
- Starts uvicorn on `http://0.0.0.0:8000`

### 4. Run under systemd (recommended)

Create `/etc/systemd/system/dashboard.service`:

```ini
[Unit]
Description=Cyber Research Portfolio
After=network.target

[Service]
Type=exec
User=dashboard
Group=dashboard
WorkingDirectory=/opt/dashboard
Environment=SKIP_BUILD=1
Environment=SKIP_SEED=1
Environment=WORKERS=2
ExecStart=/opt/dashboard/run.sh
Restart=on-failure
RestartSec=3
# Hardening
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/opt/dashboard/data /opt/dashboard/backend/.venv
ProtectHome=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dashboard
sudo chown -R dashboard:dashboard /opt/dashboard
sudo systemctl daemon-reload
sudo systemctl enable --now dashboard
sudo systemctl status dashboard
```

### 5. (Optional) nginx reverse-proxy with TLS

```nginx
server {
    listen 443 ssl http2;
    server_name dashboard.internal;

    ssl_certificate     /etc/ssl/internal/dashboard.crt;
    ssl_certificate_key /etc/ssl/internal/dashboard.key;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host               $host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto  $scheme;
        proxy_read_timeout 120s;
    }
}
```

When proxied, change the service `HOST=127.0.0.1` so only nginx can reach
uvicorn directly.

### 6. Updating

```bash
# On the build host: produce a new tgz exactly as in step 1
# On the VM:
sudo systemctl stop dashboard
tar -xzf dashboard-offline.tgz -C /opt/dashboard      # preserves data/
source /opt/dashboard/backend/.venv/bin/activate
pip install --no-index --find-links /opt/dashboard/offline/wheels \
    -r /opt/dashboard/backend/requirements.txt
sudo systemctl start dashboard
```

`data/` is never touched by the tarball extraction — projects, settings,
uploaded logos, and the JWT secret all survive upgrades.

---

## Default credentials

```
username: admin
password: ChangeMe!123
```

**Change it immediately** from **Admin → Users**. The default is documented
solely so you can log in on first launch.

## Admin features

Log in as admin → gear icon top-right:

- **Projects** — create / edit / close / delete projects; rich metadata
  (stages, tools, collaborators, Confluence/Jira/GitLab links).
- **Appearance** — app title, team name, "Campaigns" and "HS Equities"
  terminology, team logo (top bar), hero logo (landing header), footer
  resource cards, email address for "Email the team".
- **Catalogs** — edit the autocomplete lists (project types, technologies,
  tools, OSes, architectures, collaborators, customers, outcomes).
- **LLM** — configure up to 4 provider types (OpenAI-compatible, LiteLLM,
  Anthropic, Gemini) with per-provider base URL / API key / CA cert. Detect
  models live. Each saved provider has a **TEST** button that does a tiny
  round-trip to confirm end-to-end connectivity.
- **Users** — add admin / viewer accounts, change passwords, delete users.

### Logo sizing

Uploaded logos are constrained by accepted formats and size:

- **Accepted**: PNG, JPEG, WEBP (SVG intentionally excluded — XSS risk)
- **Max size**: 5 MB
- **Top-bar slot**: 140 × 40 px (use a 3.5:1 aspect ratio)
- **Hero slot**: up to 360 × 160 px (roughly 2.25:1 looks best)

Images are rendered with `object-contain` into the above slots — they fill
the box while preserving aspect ratio. A fresh upload immediately replaces
the old one; the page auto-reloads so all users pick up the new image on
their next request.

## Seeding / resetting demo data

```bash
backend/.venv/bin/python scripts/seed.py    # wipes projects, keeps users + settings
```

The script is deterministic (seeded RNG) so demo data is reproducible.

## Air-gap notes

- **Fonts**: drop Inter and JetBrains Mono `.woff2` files into
  `frontend/public/fonts/` (names documented in the README there). The
  `@font-face` block in `src/index.css` is commented out by default — uncomment
  it if you add the files. Without them the app uses system UI fonts.
- **No telemetry**: the backend does not phone home. The only outbound
  network call is to the admin-configured LLM base URL.
- **No CDNs**: `index.html` references only `/assets/*` (self-hosted);
  there are no Google Fonts, fontawesome, or jsdelivr includes.

## LLM assistant

Admin → **LLM** settings:

- **Provider** — OpenAI-compatible / LiteLLM / Anthropic / Gemini
- **Base URL** — any host speaking that protocol (internal gateway, Ollama,
  vLLM, LM Studio, or a commercial API if allowed)
- **API Key** — optional for self-hosted endpoints
- **CA Certificate Path** — PEM file path on the backend host, for
  internal CAs
- **Model** — use DETECT to pull the endpoint's model list, or type it manually
- **Max Completion Tokens** — picker from 16K up to 1M (actual cap depends on
  the model)
- **Enable Assistant** — toggles the floating chat panel

When enabled, each question is sent with a compact snapshot of the full
project portfolio plus admin-configured team resources (footer links, email).
The model is asked for a natural-language answer plus an optional
`<charts>...</charts>` JSON block rendered inline with Recharts. If the
endpoint is unreachable the chat shows a friendly offline message.

## Backup

Everything persistent lives in `./data`:

- `data/app.db` — SQLite database (WAL mode)
- `data/app.db-wal`, `data/app.db-shm` — WAL sidecars (back up together)
- `data/uploads/` — uploaded logos
- `data/.jwt_secret` — JWT signing key (keep stable to preserve sessions)

Backup:

```bash
sudo systemctl stop dashboard
tar czf backup-$(date +%F).tgz data/
sudo systemctl start dashboard
```

Stopping the service briefly ensures WAL-SHM consistency; a live copy of
a WAL DB is occasionally torn.

## Security

- **Passwords** hashed with bcrypt via passlib; minimum 12 chars on
  create/change.
- **JWT** (HS256) signed with a secret auto-generated on first run, chmod
  0600, at `data/.jwt_secret`. Override via `JWT_SECRET` env var.
- **Admin endpoints** require the `admin` role. Viewers can read dashboards
  but cannot edit projects, settings, users, or LLM config.
- **Login rate limit**: 10 failed attempts per IP per 5 minutes → 429 with
  `Retry-After`.
- **Response headers**: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` disabling camera / microphone / geolocation /
  payment / usb, and `Strict-Transport-Security` over HTTPS.
- **Uploads** are size-capped (5 MB), extension-checked, AND magic-byte
  sniffed so renaming `evil.html` → `logo.png` is refused.
- **Markdown rendering** in chat strips `<script>`, `<iframe>`, `<object>`,
  `<embed>`, `<style>`, `<link>`, `<meta>`, `<form>`, `<input>`, `<button>`,
  and restricts anchor schemes to http(s) / mailto / relative (with
  `rel="noopener noreferrer"`).
- **cert_path** (used by httpx `verify=`) is validated — absolute path, no
  `..` segments, must exist and be a regular file.
- **CORS** allows only `http://localhost:5173` (vite dev); production is
  same-origin so CORS never fires.
- **SQLite** runs in WAL with `busy_timeout=5000`, `synchronous=NORMAL`,
  `foreign_keys=ON` — safe for many concurrent readers + one writer.

## Multi-user notes

- Filters are client-side React state → every browser has its own, never
  collides with another user's.
- JWT is stateless → horizontal scaling is trivial (bump `WORKERS`).
- Chat history is sent in the request body → no server-side per-user state.
- Aggregations are computed in the browser from `/api/projects` → each user
  computes their own filtered view.

## Repo layout

```
backend/              FastAPI app
  app/
    main.py           entry point, serves SPA, wires routers, security headers
    database.py       SQLAlchemy engine + WAL PRAGMAs
    models.py         SQLAlchemy models
    schemas.py        Pydantic schemas (with size caps)
    auth.py           JWT + bcrypt + dependency helpers
    crud.py           shared query/serialise helpers
    llm_client.py     <charts> parser + citation extractor
    llm_providers.py  4-provider abstraction (OpenAI/LiteLLM/Anthropic/Gemini)
    migrate.py        idempotent column + settings migrations
    routers/
      auth_routes.py      login (rate-limited) + /me
      projects.py         CRUD + close
      analytics.py        /api/analytics/dashboard (everything the UI needs)
      settings_routes.py  public + admin + catalogs + uploads
      users.py            admin-only user management
      llm_routes.py       chat, models, test, suggestions
frontend/
  src/
    App.tsx           Shell + tab router + modals
    api.ts            fetch wrapper w/ token injection
    auth.tsx          AuthProvider / useAuth
    filters.tsx       DataProvider — global project state + filter state
    aggregations.ts   client-side rollups (per-filter)
    palette.ts        shared chart colours
    stagePalette.ts   colours per project stage
    dates.ts          DD/MM/YYYY + MM/YY formatters
    components/
      TopBar.tsx  Hero.tsx  Footer.tsx
      ClassificationBar.tsx
      Card.tsx LoginModal.tsx AdminPanel.tsx
      FilterBar.tsx ProjectForm.tsx ProjectDetail.tsx
      ChatPanel.tsx Markdown.tsx SearchPalette.tsx RecentProjects.tsx
      charts/     reusable Recharts wrappers
    tabs/
      Overview.tsx Projects.tsx TypesTech.tsx
      Lifecycle.tsx Collaboration.tsx Catalog.tsx
scripts/
  seed.py                45-project deterministic seed (35 closed / 10 open)
docker-compose.yml
Dockerfile               multi-stage (node build + python runtime)
run.sh                   standalone launcher
```

## License / Handling

Internal tool. Treat the database contents at whatever classification your
team's data requires — the app itself makes no assumptions about
classification, only displays the banner text you configure.
