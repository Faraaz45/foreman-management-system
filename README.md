# Foreman Daily Report

Angular 20 front end, NestJS 11 back end, PostgreSQL.

## Logins and roles

| Role | Username / password | Sees |
|---|---|---|
| Admin | `admin` / `admin` | Dashboard, **Foreman Reports** (accept / reject submissions, per-employee attendance history), History, Admin masters, Logins, Backup/Restore |
| Foreman | `foreman` / `foreman` (shared by all foremen) | Report (pick your name), History, Admin masters |

Admin changes either password in **Admin → Logins**.

Report workflow: foreman saves a **Draft** → **Review & Send** marks it **Sent** → admin **Accepts** (frozen, final) or **Rejects** with a note → foreman edits and resubmits.

## First-time setup

```bash
createdb foreman                 # Postgres must be running (brew services start postgresql@14)
cd backend  && npm install
cd ../frontend && npm install
```

## Run

```bash
cd frontend && npm run build     # builds to frontend/dist, served by the backend
cd ../backend && npm run build && node dist/main.js
```

Open http://localhost:3000 and log in.
On first boot the backend creates the tables and seeds sectors, subsectors, foremen, cleaners, drivers, vehicle types and problem types from `backend/seed.json`.

## Development (live reload)

```bash
cd backend  && npm run start:dev        # API on :3000
cd frontend && npx ng serve             # UI on :4200, proxies /api to :3000
```

## Checks

```bash
cd backend && node smoke.js             # API self-check against the running server
```

## Configuration

| Env var | Default |
|---|---|
| `DATABASE_URL` | `postgres://localhost/foreman` |
| `SESSION_SECRET` | random per boot (sessions reset on restart) |

Passwords are salted SHA-256 hashes in the `users` table.
