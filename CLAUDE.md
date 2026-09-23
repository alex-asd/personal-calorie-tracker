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
- `npm run lint` / `npm run lint:fix` — ESLint (flat config in `eslint.config.js`). Covers `server/**/*.js` (Node globals) and `client/**/*.{js,jsx}` (browser + React + hooks). Both `react/no-unescaped-entities` and `react-hooks/set-state-in-effect` are disabled; `react-hooks/exhaustive-deps` is still on.
- `npm run format` / `npm run format:check` — Prettier (`.prettierrc`: `singleQuote`, `trailingComma: es5`, `printWidth: 100`). `eslint-config-prettier` is applied last in the ESLint config so the two don't fight.

Env vars: `PORT` (default `8002`), `DATA_DIR` (default `./data`, where `tracker.db` and WAL files live), `BASE_PATH` (default unset/root; set to a sub-path like `/calorie` to serve behind a reverse proxy — see the base-path note under Server architecture and `DEPLOYMENT.md`).

## Architecture

### Server (`server/`)

The entry point is `server/index.js` (calls `initDb()` then `createApp().listen(PORT)`). The Express app itself is built by `createApp({ serveStatic = true, requireAuth = Boolean(process.env.TRACKER_PASSWORD), basePath = process.env.BASE_PATH })` in `server/app.js`, which mounts the eight API routers under `<base>/api/*` and (when `serveStatic` is true and `client/dist/` exists) serves the built SPA with a catch-all that falls through for `<base>/api/*`. When `requireAuth` is true, `basicAuth` middleware from `server/auth.js` is mounted before everything (protects API + SPA); the username is ignored, only the password is checked against `TRACKER_PASSWORD` with `crypto.timingSafeEqual`. Tests construct the app directly via `createApp({ serveStatic: false, requireAuth: false })` so there's no listener, no static fallback, and no auth even if `TRACKER_PASSWORD` happens to be set in the shell.

**Base path (`BASE_PATH`).** `server/basePath.js` `normalizeBasePath()` turns the env value into `''` (root, the default) or `/segment` (no trailing slash). Routers and static are mounted under it, so the whole app can live under a reverse-proxy sub-path (e.g. `/calorie`) with the **same build** — the proxy must forward the prefix unchanged (Caddy `handle`, not `handle_path`; nginx `proxy_pass` with no trailing slash). Vite emits root-absolute asset URLs (`/assets/…`); the catch-all serves index.html through `applyBasePathToHtml()` (also in `basePath.js`), which prefixes those URLs with the base and injects `window.__APP_BASE__` so the client knows its mount point (see `client/src/basePath.js`). At the root, `applyBasePathToHtml` only injects `__APP_BASE__="/"` and leaves URLs untouched. When a base is set, a bare-root request (`/`) 302-redirects to `<base>/`. Tests default `basePath` to unset → routes stay at `/api/*`, so the rest of the suite is unaffected.

Routers map 1:1 to the data model:

- `/api/sessions` — open/close/list sessions, fetch days for an archived session.
- `/api/meals` — list/add/edit/delete meals for the open session.
- `/api/saved-meals` — manage the reusable meal library (each meal optionally filed under one category).
- `/api/categories` — user-created categories for the saved-meal library (CRUD; names unique case-insensitively).
- `/api/weights` — `GET /api/weights` returns the open session's full weight history (`start_weight_kg`, `goal_weight_kg`, and the daily logs ascending by date); it is the single read the client uses for the chart, the Today card, the day modal and the history rows. `PUT /:date` upserts the weight for any day of the open session (`start_date`..today, validated by `validateSessionDate()` in `server/dates.js`, shared with the meals router; 201 on create, 200 on replace, 403 when blocked) and `DELETE /:date` clears it. `GET /today`, `POST /` (409 if already logged) and `DELETE /today` remain for compatibility; `/today` is mounted before `/:date` so the literal wins.
- `/api/activities` — the activity catalog (`activities` table): the five seeded presets plus user-created custom activities. CRUD like categories (names unique case-insensitively, `unit` defaults to `'reps'`); `PUT`/`DELETE` on a preset return 403. Each row carries `is_preset` (boolean) and `log_count` (days logged across all sessions, used by the delete confirm).
- `/api/activity-logs` — per-day activity totals for the open session (`daily_activities`). `GET ?date=` (default today) returns `{ date, logs: [{ activity_id, amount }] }`. `POST /` with `{ activity_id, amount, date? }` **adds** to that day's total (201 created / 200 incremented); `PUT /:date/:activityId` **replaces** it (201/200); `DELETE /:date/:activityId` clears it. Dates go through `validateSessionDate()`; every write 403s when the session is blocked. The client only uses today so far — past-day/archive display is a planned follow-up.
- `/api/export` — pretty-printed JSON dump of the current open session (now including `daily_activities` with each activity's name and unit).

`server/db.js` owns the schema. Tables: `sessions`, `saved_meals`, `meals`, `daily_totals`, `daily_weights`, `categories`, `activities`, `daily_activities`. Key constraints:

- Partial unique index `idx_one_open_session` enforces **at most one open session** at the DB level.
- `meals` carry their own nutrition copy plus an optional `source_saved_meal_id` (`ON DELETE SET NULL`) so editing/deleting a SavedMeal never mutates historical entries.
- `saved_meals.category_id` is an optional FK to `categories` (`ON DELETE SET NULL`), so deleting a category just drops its meals back to "Uncategorized" (null). Categories apply **only** to the saved-meal library — logged `meals` are never categorized. `categories.name` is `UNIQUE COLLATE NOCASE`.
- `daily_totals` is maintained incrementally inside transactions in `routes/meals.js` (insert adds, edit applies the delta, delete subtracts). It is **not** recomputed from `meals` — the source of truth for archived-session day totals is `daily_totals`, which is why closing a session deletes `meals` but keeps `daily_totals`.
- `sessions.goal_weight_kg` is an optional REAL set at session creation (added in migration `004`). It's purely a display target for the Home weight-progress chart — nothing on the server enforces or compares against it.
- `sessions.phase` is a NOT NULL TEXT column added in migration `005` with a CHECK constraint allowing only `'cut'` or `'bulk'` and defaulting to `'cut'`. It is purely a display-coloring hint — no route gates behavior on it — and only the calories progress bar (`client/src/components/ProgressBar.jsx`, passed `phase={session.phase}` by `DayHistoryTable`) reads it; on a bulk the calories bar swaps to the protein hue curve (red while under target, green once met). Protein behavior is unchanged in both phases.
- `activities` (migration `006`) is a global catalog, not session-scoped. The migration seeds five presets (`is_preset = 1`: Steps/steps, Pull-ups, Push-ups, Sit-ups, Squats/reps) that the API refuses to change or delete; custom rows have `is_preset = 0`. Listing order is `is_preset DESC, id ASC` (presets in seeded order, then customs oldest-first). `daily_activities` holds one running total per `(session_id, date, activity_id)` with `amount REAL CHECK (amount > 0)` (decimals allowed for custom units like km); its `activity_id` FK is `ON DELETE CASCADE`, so deleting a custom activity deletes its logs. Unlike `daily_weights`, `daily_activities` is **kept** when a session closes.
- Schema migrations live in `server/migrations/` as zero-padded SQL files (e.g. `001_initial.sql`, `002_session_weight.sql`, `003_meal_categories.sql`, `004_session_goal_weight.sql`, `005_session_phase.sql`, `006_activities.sql`). `server/migrate.js` runs unapplied files in order inside a transaction and records them in a `_migrations` table. Adding a schema change means writing a new `NNN_*.sql` file — never edit a previously-shipped migration. On the first boot after a database existed under the old inline-schema regime, the runner detects the legacy schema (presence of `sessions` without a `_migrations` row) and, for each file with an entry in `LEGACY_PROBES` (a filename → schema-check map covering `001`–`005`), records it as applied without running it **only if its effects are already present** (table/column exists); otherwise the file runs normally. The same probes also repair databases where an older runner falsely recorded a file as applied: a recorded file whose probe fails is re-run on the next boot. Migrations `006+` need no probe — they only ever run through the runner.
- `initDb({ dbPath } = {})` accepts an override path; tests pass `':memory:'` for isolation. WAL mode is skipped for in-memory databases. `closeDb()` is exported for test teardown / reset.

`server/dates.js` deliberately uses local-timezone `YYYY-MM-DD` strings (not `toISOString()` / UTC). Day boundaries follow the Pi's local clock. All date comparisons across the codebase are string comparisons on this format — keep it that way.

### Session lifecycle & 90-day rule

- A "day number" is `daysBetween(start_date, today()) + 1`.
- `dayNumber === 90` → `warning: true` is decorated on the current session.
- `dayNumber > 90` → `blocked: true`; meal, weight and activity-log writes return 403. The user must close the session to unblock. There is no auto-close.
- Closing a session: inside a transaction, deletes rows from `meals` and `daily_weights` for that session, sets `status='closed'` and `end_date=today()`. `daily_totals` is preserved for the Archive view; `daily_activities` is preserved too (not yet displayed in the archive).

### Editing past days (open session)

Any day of the **open** session is editable, from `start_date` up to and including today:

- `meals` POST accepts an optional `date` in the body. `validateDate()` defaults it to `today()` and rejects malformed dates, dates before `start_date`, and future dates (400). The `daily_totals` upsert is keyed by that `date`.
- `meals` PUT/DELETE no longer gate on `meal.date === today()`; they edit/delete any meal in the open session and apply the delta to `meal.date`. Both still 403 when the session is **blocked** (past 90 days) — the user must close it first.
- Archived sessions stay read-only (their `meals` rows are deleted on close; only `daily_totals` survives).

On the client, the Home History table (`DayHistoryTable`) rows are clickable (via an opt-in `onSelectDay` prop) and open `DayDetailModal`, which shows that day's weight (log/edit/clear via `WeightEntry`) and lists that day's meals with add/edit/delete (reusing `MealList` + `AddMealModal`, the latter taking an optional `date` prop). Home also passes `weightsByDate` to the table so each past row shows its logged weight or "no weight", making missed days obvious. The same `DayHistoryTable` rendered read-only in `SessionDetail` omits `onSelectDay`, so archive rows are not clickable.

### Client (`client/src/`)

- `main.jsx` mounts `<App />` inside `<BrowserRouter basename={ROUTER_BASENAME}>` and `<QueryClientProvider>`. The React Query devtools panel is mounted dev-only via `import.meta.env.DEV`.
- `basePath.js` is the client's single source of truth for the mount point. It reads `window.__APP_BASE__` (injected by the server, see Server architecture) and exports `BASE_PATH` (`/` or `/calorie/`), `BASE_PREFIX` (`''` or `/calorie`, prepended to every `fetch` in `api.js` and the export `<a href>` in `SessionHeader`), and `ROUTER_BASENAME` (the router basename). In dev there's no injection, so it falls back to `/` and everything stays root-relative — the Vite `/api` proxy is unaffected.
- `App.jsx` declares four routes: `/`, `/saved-meals`, `/archive`, `/archive/:id`. No top-level state provider beyond the router + query client — server state lives entirely in the TanStack Query cache.
- `queryClient.js` defines the singleton with `staleTime: 30s`, `gcTime: 5m`, `refetchOnWindowFocus: true`, `retry: 1`. `queryKeys.js` centralises query keys so invalidation is typo-proof; reuse it instead of writing key arrays inline.
- `hooks/useSession.js` exposes `useSession()`, `useCreateSession()`, `useCloseSession()` — thin wrappers around `useQuery` / `useMutation` against `/api/sessions/current`. The query cache replaces the old SessionContext as the single source of truth for the open session.
- Components use `useQuery` for reads and `useMutation` for writes. Mutations invalidate the relevant cache keys in `onSuccess` (see the invalidation map below) — they do **not** call back into the parent to trigger a refetch. Parent `onSave` / `onAdded` callbacks now only handle local UI (closing an editor or modal).
- `api.js` is a tiny `fetch` wrapper that throws `Error(data.error || 'HTTP <status>')`. Server endpoints consistently return `{ error: '...' }` on failure; preserve that shape when adding routes so client error messages stay useful. `api.js` is the `queryFn` / `mutationFn` body throughout.
- Pages live in `pages/`, reusable UI in `components/`. The Add Meal flow is a modal (`AddMealModal.jsx`) launched from `Home.jsx` (or from `DayDetailModal.jsx` with a `date` prop for past days).
- Meal reads are keyed per date: `queryKeys.meals.list(date)`. Home reads today (`meals.list(todayString())`); `DayDetailModal` reads its day. All meal mutations invalidate the `queryKeys.meals.all` (`['meals']`) prefix, which matches every date sub-key. Local date helpers (`todayString`, `formatLabel`, `parseLocal`, `shiftDateString`) live in `client/src/dates.js`.
- Home section order is `SessionHeader` → `TodayTotals` → `MealList` → `WeightLogger` → `WeightChart` → `ActivityLogger` → `DayHistoryTable`. `TodayTotals` renders the four-macro totals grid first, then today's calorie + protein progress bars below it (using the same `ProgressBar` as the history table, with `phase={session.phase}` on the calories bar); `DayHistoryTable` on Home is filtered to past days only (`d.date !== todayString()`), so today never appears in History. The archive view (`SessionDetail`) passes the unfiltered `days` so closed sessions still show every day, including the close day. `WeightLogger` is a thin card around `WeightEntry` (`components/WeightEntry.jsx`), the one log/edit/clear control for a given date; `DayDetailModal` reuses it for past days. `WeightChart` reads `useWeightHistory()` and renders a hand-rolled SVG (no chart-lib dependency) — area + line through the points, dashed goal line when `session.goal_weight_kg` is set, faint linear-regression trend line, hover/touch crosshair tooltip, and headline stats (current / from start / to goal / weekly trend). When `start_weight_kg` is set it is drawn as a hollow ring on day 0 and the "from start" delta is measured against it; if a weight was also logged on the start date, the start point is shifted to day −1 (the x-axis then begins there) so both points are kept and joined by the line. Empty and single-point states fall back to a short text message.
- `ActivityLogger` is the Activities card: it reads `useActivities()` + `useActivityLogs(todayString())` (both in `hooks/useActivities.js`) and renders one `ActivityEntry` per activity. `ActivityEntry` takes a `date` (like `WeightEntry`) so it can be reused for past days later; each row has an amount input with **Add** (POST, increments), **Set** (PUT, replaces) and **×** (DELETE). A header toggle swaps the list for `ActivityManager` (add/rename/delete custom activities, mirroring `CategoryManager`; presets are listed but not editable).

#### Mutation → cache invalidation map

When adding a new mutation, update this table and the mutation's `onSuccess`. `currentSessionId` is read from `queryClient.getQueryData(queryKeys.sessions.current())?.id` inside `onSuccess`.

| Mutation                      | Invalidates / sets                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Create session                | sets `sessions.current()`; invalidates `sessions.all`                                                                                        |
| Close session                 | clears `sessions.current()`; invalidates `sessions.all`                                                                                      |
| Add meal                      | `meals.all` (all date keys), `sessions.days(currentSessionId)`; also `savedMeals.list()` + `categories.list()` if `save_to_library` was true |
| Edit meal                     | `meals.all`, `sessions.days(currentSessionId)`                                                                                               |
| Delete meal                   | `meals.all`, `sessions.days(currentSessionId)`                                                                                               |
| Saved-meal create/edit/delete | `savedMeals.list()` only — historical `meals` carry their own nutrition copy and are unaffected                                              |
| Category create/rename        | `categories.list()` only                                                                                                                     |
| Category delete               | `categories.list()` **and** `savedMeals.list()` (its meals get `category_id = NULL` server-side)                                             |
| Set weight (any date)         | `weights.all` — every consumer reads `weights.history(sessionId)` via `useWeightHistory()` in `hooks/useWeights.js`                          |
| Clear weight (any date)       | `weights.all`                                                                                                                                |
| Activity create/edit          | `activities.list()`                                                                                                                          |
| Activity delete               | `activities.list()` **and** `activityLogs.all` (its logs are cascade-deleted server-side)                                                    |
| Add / set / clear activity    | `activityLogs.all` **and** `activities.list()` (refreshes `log_count`) — every consumer reads `activityLogs.list(sessionId, date)`           |

### Tests (`server/__tests__/`)

Backend-only integration suite using Vitest + supertest. Each test calls `createTestApp()` (in `helpers/app.js`) which closes any existing DB, initializes a fresh in-memory SQLite, and returns a no-static Express app. Tests hit it via `supertest(app)` — no port binding.

- `helpers/seed.js` exposes `makeSession({ startDaysAgo, status, ... })`, `insertMeal`, `insertSavedMeal`, `getDailyTotal`, `getMealRow`. The 90-day boundary tests work by **seeding sessions with backdated `start_date`s** rather than mocking `today()` — simpler and avoids module-level patching of date helpers across routes.
- `npm test` runs with `TZ=UTC` because `server/dates.js` builds `YYYY-MM-DD` from local time; without the pin, tests would drift near midnight in non-UTC zones.
- When adding a new router, add a test file next to the others. Cover at minimum: the happy path, the validation 400s, and any session-gating (open/blocked/date-range) the route enforces.

### Dev → prod path

Two modes share the same backend:

1. **Dev:** Vite on `:5173` with `/api` proxy → Express on `:8002`. Hot reload on both halves.
2. **Prod:** `npm run build` populates `client/dist/`; Express serves it and any `GET` that isn't `/api/*` falls back to `index.html` (so React Router client-side routes work on refresh).

When making changes that touch both halves, remember the prod path only works after `npm run build` — `npm start` alone does not rebuild the client.
