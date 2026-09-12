# Foreman Daily Report — App Design & Action Plan

Source: `deepseek_html_20260823_1e4ab1.html` (single-page app, localStorage only).
Goal: same features, one admin login, data in a local PostgreSQL database.

## 1. Technology decision (final — built)

| Layer | Choice |
|---|---|
| Front end | Angular 20, standalone components + signals, `FormsModule`, `xlsx` for Excel import/export. `frontend/` |
| Back end | NestJS 11, `pg` driver with raw SQL (no ORM), signed-cookie session. `backend/` |
| Database | PostgreSQL 14 (Homebrew), database `foreman`, schema auto-created and seeded on first boot |
| Serving | Backend serves the built Angular app from `frontend/dist` on http://localhost:3000; `ng serve` proxies `/api` in dev |

Files: `backend/src/{main,app.module,db.service,auth,api.controller}.ts`, `backend/seed.json`, `backend/smoke.js`;
`frontend/src/app/{api,app,dashboard,report,history,admin,excel}.ts`. Run instructions are in `README.md`.

## 2. Functionality (carried over from the HTML)

**Login** (new): `users` table, two shared logins: `admin`/`admin` and `foreman`/`foreman`. Signed cookie session carries `{username, role}`.
- Foreman: Report tab (picks his name), History, Admin masters. Cannot review, manage logins, backup/restore, or change an Accepted report.
- Admin: Dashboard, Foreman Reports (accept/reject with note, expandable details, per-employee attendance history), History, Admin masters + Logins card, Backup/Restore.

**Report status flow**: Draft → Sent (foreman) → Accepted | Rejected (admin, `PUT /api/reports/:id/review`). Rejected can be edited and resubmitted. Accepted is frozen for the foreman.

**Dashboard tab**: date + foreman/sector/subsector filters. Stat cards (expected, present, attendance %, absent, vehicles, broken bins). Subsector performance table (sorted worst-first, colour bands ≥90 / ≥75 / <75). Foreman performance table with report status. Problem-type breakdown. Vehicle-type breakdown.

**Report tab**: pick foreman → ID, sector, subsector(s), route count auto-fill. Date + shift start/end. Live KPI banner. Labour table pre-filled with the foreman's cleaners (route, ID, name, attendance dropdown, brush/shovel/picker/chart checkboxes, max 27 rows, add/remove). Vehicle blocks (fleet ID, type, task, from/to, driver, N labourers). Broken bins (ref, location with GPS button, problem type). Save (Draft), Review & Send (marks Sent, shares summary text via Web Share / clipboard, offers Excel), Reset, Edit existing report. Auto-draft in `sessionStorage` (unchanged, client only).

**History tab**: search by foreman name, date range, foreman, sector, status filters. Per report: edit, delete, mark sent. Export Excel (4 sheets: Labour, Vehicles, Bins, Summary).

**Admin tab**: add/delete for foremen, cleaners, drivers, vehicle types, sectors, subsectors, problem types, with search on foremen/cleaners. Excel import for subsectors, foremen, cleaners, drivers. Backup (download JSON) / Restore (upload JSON) — kept as two tiny endpoints.

Dropped: nothing functional. The `migrateData()` / `seedHRData()` version-migration code goes away because the DB is seeded once.

## 3. Database schema

```sql
CREATE TABLE sectors       (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE foremen       (id TEXT PRIMARY KEY, name TEXT NOT NULL, sector_id TEXT REFERENCES sectors(id),
                            subsector TEXT, route_count INT DEFAULT 0,
                            vehicle_brand TEXT DEFAULT '', plate_number TEXT DEFAULT '', phone_number TEXT DEFAULT '');
CREATE TABLE subsectors    (id SERIAL PRIMARY KEY, sector_id TEXT REFERENCES sectors(id), name TEXT UNIQUE NOT NULL,
                            route_count INT DEFAULT 0, foreman_id TEXT REFERENCES foremen(id) ON DELETE SET NULL);
CREATE TABLE labourers     (id TEXT PRIMARY KEY, name TEXT NOT NULL, subsector TEXT, route TEXT DEFAULT '');
CREATE TABLE drivers       (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE vehicle_types (name TEXT PRIMARY KEY);
CREATE TABLE problem_types (name TEXT PRIMARY KEY);
CREATE TABLE reports       (id SERIAL PRIMARY KEY, foreman_id TEXT REFERENCES foremen(id),
                            date DATE NOT NULL, shift_start TEXT, shift_end TEXT,
                            status TEXT NOT NULL DEFAULT 'Draft',
                            labour_rows JSONB NOT NULL DEFAULT '[]',
                            vehicle_blocks JSONB NOT NULL DEFAULT '[]',
                            bin_rows JSONB NOT NULL DEFAULT '[]',
                            created_at TIMESTAMPTZ DEFAULT now());
```

Report sub-rows stay as JSONB in the exact shape the front end already produces. The dashboard/KPI/export code keeps working unchanged. `-- ponytail: JSONB sub-rows; split into labour_rows/vehicles/bins tables if SQL reporting across reports is ever needed.`

Schema is applied with `CREATE TABLE IF NOT EXISTS` on server boot. Database is created once: `createdb foreman`.

Seed data (from the HTML): 9 sectors, 29 subsectors, 28 foremen, 898 cleaners, 11 drivers, 4 vehicle types, 5 problem types. `seed.js` regex-extracts these arrays from the HTML file and inserts with `ON CONFLICT DO NOTHING`.

## 4. API (all JSON under /api, all behind the login cookie)

| Method & path | Does |
|---|---|
| `POST /login`, `POST /logout` | admin/admin → sets cookie |
| `GET /api/state` | Whole dataset in the old `AppState.data` shape (masters + reports). One call on load, one call after every write. Simplest possible port. |
| `POST /api/master/:table` | Insert one row (foremen, labourers, drivers, sectors, subsectors, vehicle_types, problem_types). Also used by Excel import (batch of rows). |
| `DELETE /api/master/:table/:id` | Delete one row |
| `POST /api/reports`, `PUT /api/reports/:id`, `DELETE /api/reports/:id` | Report save / edit / delete. `PUT` with `{status:'Sent'}` = mark sent. |
| `GET /api/backup`, `POST /api/restore` | Full JSON dump / load |

Table name whitelist guards `:table`. All queries parameterised. `-- ponytail: GET /api/state reloads everything after each write (~1000 rows, milliseconds); paginate only if it ever feels slow.`

Front-end change is mechanical: `AppState.save()` → the matching `fetch` then `refreshAll()`; `AppState.load()` → `fetch('/api/state')`.

## 5. Status

Built and verified on 2026-09-12: backend self-check (`backend/smoke.js`) and a Playwright browser run through login, report entry, save, mark sent, dashboard, edit, admin add/delete, and logout all pass.

## 6. Assumptions

- Passwords are `admin` and `foreman`. Change them in Admin → Logins.
- Local only: binds to localhost, no HTTPS, no rate limiting, single user.
- Report sub-rows are JSONB in the shape the UI produces (`-- ponytail:` split into tables if SQL reporting across reports is needed).
- Subsector names are unique across sectors (true for the seed data).
