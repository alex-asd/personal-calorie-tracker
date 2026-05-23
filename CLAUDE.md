# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Self-hosted single-user calorie/nutrition tracker. Runs on a Raspberry Pi behind Tailscale (no auth — access control is the tailnet). Node + Express + better-sqlite3 backend, React (Vite) frontend, SQLite as the only store. See `REQUIREMENTS.md` for product spec and `DEPLOYMENT.md` for Pi/systemd setup.

## Commands

Run from the repo root:

- `npm run dev` — runs server (`node --watch server/index.js` on `:8002`) and Vite client (`:5173`) together via `concurrently`. Vite proxies `/api/*` → `:8002`.
- `npm run dev:server` / `npm run dev:client` — start either half on its own.
- `npm run build` — installs client deps and produces `client/dist/`. Express serves that bundle automatically when present; otherwise non-`/api` requests return a "client build not found" message.
- `npm start` — production: runs the server only. Requires that `npm run build` has been run.
- `npm test` — runs the Vitest backend integration suite once (TZ pinned to UTC).
- `npm run test:watch` — same suite in watch mode.
- `npm run lint` / `npm run lint:fix` — ESLint (flat config in `eslint.config.js`). Covers `server/**/*.js` (Node globals) and `client/**/*.{js,jsx}` (browser + React + hooks). Both `react/no-unescaped-entities` and `react-hooks/set-state-in-effect` are disabled — the latter would flag the project's standard `useEffect(() => refresh(), [refresh])` data-load pattern; `react-hooks/exhaustive-deps` is still on.
- `npm run format` / `npm run format:check` — Prettier (`.prettierrc`: `singleQuote`, `trailingComma: es5`, `printWidth: 100`). `eslint-config-prettier` is applied last in the ESLint config so the two don't fight.

Env vars: `PORT` (default `8002`), `DATA_DIR` (default `./data`, where `tracker.db` and WAL files live).

## Architecture

### Server (`server/`)

The entry point is `server/index.js` (calls `initDb()` then `createApp().listen(PORT)`). The Express app itself is built by `createApp({ serveStatic = true })` in `server/app.js`, which mounts the five API routers under `/api/*` and (when `serveStatic` is true and `client/dist/` exists) serves the built SPA with a catch-all that falls through for `/api/*`. Tests construct the app directly via `createApp({ serveStatic: false })` so there's no listener and no static fallback.

Routers map 1:1 to the data model:

- `/api/sessions` — open/close/list sessions, fetch days for an archived session.
- `/api/meals` — list/add/edit/delete meals for the open session.
- `/api/saved-meals` — manage the reusable meal library.
- `/api/weights` — daily weight log (one entry per day, replace-by-delete).
- `/api/export` — pretty-printed JSON dump of the current open session.

`server/db.js` owns the schema. Tables: `sessions`, `saved_meals`, `meals`, `daily_totals`, `daily_weights`. Key constraints:

- Partial unique index `idx_one_open_session` enforces **at most one open session** at the DB level.
- `meals` carry their own nutrition copy plus an optional `source_saved_meal_id` (`ON DELETE SET NULL`) so editing/deleting a SavedMeal never mutates historical entries.
- `daily_totals` is maintained incrementally inside transactions in `routes/meals.js` (insert adds, edit applies the delta, delete subtracts). It is **not** recomputed from `meals` — the source of truth for archived-session day totals is `daily_totals`, which is why closing a session deletes `meals` but keeps `daily_totals`.
- Schema migrations: `initDb` runs `CREATE TABLE IF NOT EXISTS` plus targeted `ALTER TABLE ADD COLUMN` guards (see `start_weight_kg` / `end_weight_kg`). Add new columns the same way rather than rewriting tables.
- `initDb({ dbPath } = {})` accepts an override path; tests pass `':memory:'` for isolation. WAL mode is skipped for in-memory databases. `closeDb()` is exported for test teardown / reset.

`server/dates.js` deliberately uses local-timezone `YYYY-MM-DD` strings (not `toISOString()` / UTC). Day boundaries follow the Pi's local clock. All date comparisons across the codebase are string comparisons on this format — keep it that way.

### Session lifecycle & 90-day rule

- A "day number" is `daysBetween(start_date, today()) + 1`.
- `dayNumber === 90` → `warning: true` is decorated on the current session.
- `dayNumber > 90` → `blocked: true`; meal and weight POSTs return 403. The user must close the session to unblock. There is no auto-close.
- Closing a session: inside a transaction, deletes rows from `meals` and `daily_weights` for that session, sets `status='closed'` and `end_date=today()`. `daily_totals` is preserved for the Archive view.

### Today-only edit window

`meals` PUT/DELETE check `meal.date !== today()` and reject earlier days with 403. The Home UI surfaces today's meals as editable; the 90-day history table is read-only by design.

### Client (`client/src/`)

- `main.jsx` mounts `<App />` inside `<BrowserRouter>`.
- `App.jsx` wraps routes in `<SessionProvider>`. Four routes: `/`, `/saved-meals`, `/archive`, `/archive/:id`.
- `SessionContext.jsx` is the single source of truth for the current open session on the client. Components call `useSession()` and use `refresh()` after mutations that change session-level fields. Per-page lists (today's meals, history, saved meals, weights) manage their own fetch state — `SessionContext` does **not** cache them.
- `api.js` is a tiny `fetch` wrapper that throws `Error(data.error || 'HTTP <status>')`. Server endpoints consistently return `{ error: '...' }` on failure; preserve that shape when adding routes so client error messages stay useful.
- Pages live in `pages/`, reusable UI in `components/`. The Add Meal flow is a modal (`AddMealModal.jsx`) launched from `Home.jsx`.

### Tests (`server/__tests__/`)

Backend-only integration suite using Vitest + supertest. Each test calls `createTestApp()` (in `helpers/app.js`) which closes any existing DB, initializes a fresh in-memory SQLite, and returns a no-static Express app. Tests hit it via `supertest(app)` — no port binding.

- `helpers/seed.js` exposes `makeSession({ startDaysAgo, status, ... })`, `insertMeal`, `insertSavedMeal`, `getDailyTotal`, `getMealRow`. The 90-day boundary tests work by **seeding sessions with backdated `start_date`s** rather than mocking `today()` — simpler and avoids module-level patching of date helpers across routes.
- `npm test` runs with `TZ=UTC` because `server/dates.js` builds `YYYY-MM-DD` from local time; without the pin, tests would drift near midnight in non-UTC zones.
- When adding a new router, add a test file next to the others. Cover at minimum: the happy path, the validation 400s, and any session-gating (open/blocked/today-only) the route enforces.

### Dev → prod path

Two modes share the same backend:

1. **Dev:** Vite on `:5173` with `/api` proxy → Express on `:8002`. Hot reload on both halves.
2. **Prod:** `npm run build` populates `client/dist/`; Express serves it and any `GET` that isn't `/api/*` falls back to `index.html` (so React Router client-side routes work on refresh).

When making changes that touch both halves, remember the prod path only works after `npm run build` — `npm start` alone does not rebuild the client.
