# Protocol — Go Live Roadmap

**Version:** 1.0
**Last Updated:** 2026-02-20

---

## Current State

Phase 1 (Gym MVP) is feature-complete and functional. Exercises, splits, mesocycles, workout logging with progression, history, progress charts, PWA install — all working. The frontend is polished with animations, rest timers, set types (straight/myorep/myorep match), exercise replacement, per-exercise notes, and a responsive mobile-first UI.

**What's not ready:**
- ~~Database wipes on every restart (`DEV_RESET_DB=true` hardcoded)~~ — removed entirely
- ~~No migration system (schema changes = data loss)~~ — Alembic with auto-upgrade on startup
- ~~Supabase references still in code (no longer used)~~ — cleaned up
- Single shared password, no user separation
- No backups
- No tests
- Settings page is a stub
- Diet and Glucose domains: 0% implemented (not blocking go-live)

---

## Infrastructure Plan

### Current Setup
- **Railway** free tier hosting a single Docker container
- **Supabase** was the DB but is no longer used — Railway Postgres container instead
- **Local dev** via docker-compose (3 containers: postgres, backend, frontend)

### Target Setup

**Production:** VPS running Docker Compose
- App container (FastAPI serving API + React static files)
- Postgres container with a named volume for persistence
- Caddy as reverse proxy (automatic HTTPS via Let's Encrypt)
- Nightly `pg_dump` cron job for backups

**Development:** Local docker-compose (unchanged, already works)

**Railway** stays as-is until VPS is ready, then decomission.

### VPS Requirements

Any provider works (Hetzner, DigitalOcean, etc.). Minimum specs:
- 1 vCPU, 1GB RAM, 20GB disk (more than enough)
- ~$4-6/month

What you need on the VPS:
- Docker + Docker Compose
- Caddy (can run as a container too)
- A domain pointed at the VPS IP
- A cron job for DB backups
- Firewall: only ports 80, 443, and SSH open

### Production Docker Compose (sketch)

```yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql+asyncpg://protocol:${DB_PASSWORD}@db:5432/protocol
      APP_PASSWORD: ${APP_PASSWORD}
      SECRET_KEY: ${SECRET_KEY}
      PORT: "8000"
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: protocol
      POSTGRES_USER: protocol
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U protocol"]
      interval: 5s
      timeout: 3s
      retries: 5

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  pgdata:
  caddy_data:
```

### Caddyfile (sketch)

```
protocol.yourdomain.com {
    reverse_proxy app:8000
}
```

That's it. Caddy handles SSL automatically.

### Backup Strategy

A cron job that runs nightly:

```bash
# /etc/cron.d/protocol-backup
0 3 * * * docker exec protocol-db-1 pg_dump -U protocol protocol | gzip > /backups/protocol-$(date +\%Y\%m\%d).sql.gz
# Keep last 30 days
0 4 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

Optional: sync `/backups` to an S3 bucket or another location for offsite redundancy.

---

## Task Breakdown

### ~~T1: Set Up Alembic Migrations~~ DONE

Alembic configured with `migrations/` directory (renamed from `alembic/` to avoid Python import conflict). Auto-upgrade on startup via `asyncio.to_thread(run_upgrade)`. Pre-Alembic database detection stamps head instead of re-creating. Initial migration `0001_initial_schema` covers all gym MVP tables. `DEV_RESET_DB` removed entirely — use `docker compose down -v` for a full reset.

---

### ~~T2: Clean Up Supabase References~~ DONE

Removed SSL/pgbouncer/NullPool from `database.py`, dropped `supabase_url`/`supabase_key` from config, cleaned `.env.example`, updated CLAUDE.md and added outdated notice to PRD.md.

---

### T3: Multi-User Auth (Friends & Family)

**Why:** Currently one shared password with no user separation. Need to give friends their own "account" (password) with isolated data.

**What:**

**Backend:**
- Create `User` model: `id` (UUID), `name`, `password_hash`, `is_admin`, `created_at`
- Hash passwords with `passlib` (already in dependencies, currently unused)
- Login: hash the submitted password and match against all users' `password_hash` values. The password is the sole identifier — no username field
- JWT subject becomes user ID instead of the string `"user"`
- `get_current_user` dependency returns a `User` object
- Add nullable `user_id` FK to: `Exercise`, `Split`, `Mesocycle`
  - `user_id = NULL` → system/seed data (visible to all)
  - `user_id = <uuid>` → user-created (visible only to that user)
- All queries: `WHERE user_id = :current_user OR user_id IS NULL` for reads, `WHERE user_id = :current_user` for writes
- Admin endpoints (protected by `is_admin` flag):
  - `POST /api/users` — create user, generate password, return it once
  - `GET /api/users` — list users
  - `DELETE /api/users/{id}` — remove user and their data
- Remove `APP_PASSWORD` env var (passwords now live in the DB)
- First-run setup: if no users exist, create admin user from env vars (`ADMIN_NAME`, `ADMIN_PASSWORD`) or prompt on first request

**Frontend:**
- Login form: single password field (no username)
- No registration page — admin creates users via settings page or API
- Settings page: admin section to manage users (create, view, delete)

**Migration:** Alembic migration adds `users` table, adds nullable `user_id` columns to existing tables, creates the admin user, assigns all existing data to that admin user.

---

### T4: Data Import Script

**Why:** You have existing workout history in another gym app that you want to bring over so you can pick up where you left off.

**Source:** RP Strength (RP Hypertrophy app). No API or built-in export. Two paths to get data out:
- GDPR data request submitted (30-day wait)
- Manual extraction via Claude Chrome extension (in progress)

**What (once data is available):**
- Write a one-time Python script in `/backend/scripts/import_rp.py`
- Map RP exercises to Protocol's exercise library (name matching + manual overrides for naming differences)
- Build mesocycle structures from historical workout data
- Run against the database directly (not through the API)
- Validate: check imported data renders correctly in the UI

**Depends on:** T1 (Alembic) and T3 (User model) — import should assign data to the correct user. Also blocked on getting the actual data out of RP Strength.

**Not blocking go-live.** You can start using Protocol fresh and import history later — it'll show up in progress charts retroactively.

---

### T5: VPS Setup & Deployment

**Why:** Move off Railway free tier, learn ops, have full control.

**What:**
- Provision VPS (Hetzner recommended for price/performance in EU)
- Install Docker + Docker Compose
- Point domain/subdomain to VPS IP
- Create production `docker-compose.prod.yml` (app + postgres + caddy)
- Create `Caddyfile` for reverse proxy + auto-SSL
- Set up `.env` file on VPS with secrets
- Set up backup cron job
- Set up basic firewall (ufw: allow 80, 443, SSH)
- Deploy: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- Optional: simple deploy script or GitHub Action that SSHs in and redeploys on push to main

**Does NOT need:**
- CI/CD pipeline (overkill — a deploy script or manual `git pull` is fine)
- Monitoring stack (check it manually, it's a personal app)
- Log aggregation (docker logs is enough)

---

### ~~T6: Disable `DEV_RESET_DB` Default~~ DONE

Went further than planned: removed `DEV_RESET_DB` entirely (config field, env var, `reset_and_reseed` function, all code paths). Full reset is now `docker compose down -v && docker compose up`.

---

### T7: Core Tests

**Why:** Two people pushing to main with no PR reviews. Tests are your safety net against breaking progression logic or data corruption.

**What:**
- Test the critical data paths:
  - `build_mesocycle_structure()` — correct weeks, sessions, sets, RiR scheme
  - `compute_progression()` — weight increases when target reps hit, no increase when not
  - `get_current_position()` — correctly finds next unlogged session
  - Workout logging — sets marked as logged, structure updated correctly
- Test auth flow (login, JWT validation, protected routes)
- Test basic CRUD (exercises, splits, mesocycles)
- Use pytest-asyncio with a test database (separate from dev)
- Infrastructure already configured in `pyproject.toml`

**Not needed yet:** Frontend tests, E2E tests, 100% coverage. Just the paths where bugs = data corruption.

---

### T8: Settings Page & Polish

**Why:** The settings page is a stub. Some basic settings are needed for daily use.

**What (minimum viable):**
- Password change (once multi-user is in)
- Data export (JSON dump of all user data — was a PRD goal)
- App info / version
- Theme toggle (if desired, but the current dark theme is solid)

**Also consider:**
- More pre-seeded splits beyond "Hero Split"
- Exercise edit/delete in the frontend (backend supports it, UI doesn't expose it)
- Fixing any workout flow rough edges discovered during testing

---

## Suggested Order of Execution

```
T1: Alembic ──────┐
  ✅ DONE          ├──→ T3: Multi-User Auth ──→ T4: Data Import
T2: Supabase ─────┘     ⬅ YOU ARE HERE  │
  ✅ DONE                               │
                                        ├──→ T5: VPS Setup
T6: DEV_RESET_DB                        │
  ✅ DONE ──────────────────────────────┘
                                  T7: Tests (anytime, in parallel)
                                  T8: Settings & Polish (ongoing)
```

**Reasoning:**
1. **T1 first** — everything else depends on being able to change the schema safely
2. **T2 alongside T1** — pure cleanup, no dependencies
3. **T3 after T1** — needs a migration for the User model
4. **T6 before or with T3** — don't accidentally wipe the user table you just created
5. **T4 after T3** — imported data needs to be assigned to a user
6. **T5 after T3** — deploy to VPS with multi-user ready, not before
7. **T7 anytime** — write tests as you go, especially after T3
8. **T8 ongoing** — polish as you use the app

---

## PRD Updates Needed

The PRD (`docs/PRD.md`) was written at project start and has drifted. Key things to update:

| Section | What Changed |
|---------|-------------|
| Tech Stack table | Supabase → self-hosted Postgres, Railway → VPS |
| Architecture diagram | Remove Supabase Storage, show VPS with Caddy |
| Supabase Free Tier section | Remove entirely |
| Cost estimates | VPS ~$4-6/mo + domain, no Supabase |
| Authentication | Multi-user with generated passwords, not single env-var password |
| Data Model — Gym | Actual schema differs from PRD (JSONB structure instead of WorkoutLog table, single muscle_group instead of array, etc.) |
| Security | HTTPS via Caddy/Let's Encrypt, not Railway |
| Non-Goals | "Multi-user support" is now a goal (friends & family) |
| Getting Started | Completely different setup flow |

These updates are not blocking but should happen alongside the work to keep docs accurate.

---

## Decisions (Resolved)

1. **Login UX:** Password-only. Each user gets a unique generated password (e.g. `a&^*hgsdh_felix_kjshf*(YFD`). The password itself identifies the user — no username field. On login, the backend hashes the input and matches against all user records. Admin creates users and hands them their password.

2. **Shared vs per-user data:**
   - **Seed exercises** (the ~57 pre-seeded ones): shared/system-level, visible to all users, no `user_id`
   - **Custom exercises** created by users: per-user (`user_id` FK), only visible to that user
   - **Seed splits** (Hero Split etc.): shared templates, visible to all as starting points
   - **User-created splits, mesocycles, all workout data**: per-user, fully isolated

3. **Deploy strategy:** GitHub Action that SSHs into VPS and redeploys on push to `main`.

4. **Data import:** Source is RP Strength. No API or export feature. GDPR data request submitted (30-day wait). Parallel effort: extracting data manually via Claude Chrome extension. Import script will be written once the data format is known — this task is blocked until data is available.

5. **Domain:** Not yet acquired. Needed before VPS go-live (Caddy requires a domain for auto-SSL). Can use a cheap `.dev` or `.app` domain, or any registrar.

## TODO

- [ ] Pick and register a domain
- [ ] Choose VPS provider and provision instance
- [ ] Decide on backup offsite location (S3 bucket, second VPS, or just local on VPS)
