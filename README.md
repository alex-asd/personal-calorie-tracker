# Personal Calorie Tracker

A self-hosted single-user calorie and macro tracker. Manual entry only — no
food database, no estimation, no external API calls. Built for a Raspberry Pi
behind a private Tailscale network.

> ## ⚠️ Security: read before you deploy
>
> **This app has no authentication.** Anyone who can reach the HTTP port has
> full read/write access to your data.
>
> It is designed to live on a Tailscale tailnet (or another trusted private
> network) where access control is delegated to the network layer. **Do not
> expose it to the public internet, a shared LAN, or any environment you
> don't fully control.** The server binds `0.0.0.0` by default, so a single
> firewall or port-forwarding mistake is enough to publish your data.
>
> There is no rate limiting, no CSRF protection, no security headers, and no
> account isolation by design. If you need those, this is not the right
> project — fork it and add an auth layer first.

## What you can do with it

- Run a "session" (up to 90 days) with daily calorie and protein targets.
- Log meals one at a time. Calories and protein are required; carbs and fat
  are optional.
- Reuse common meals from a saved-meal library; edits to the library don't
  rewrite historical entries.
- See the last 90 days of daily totals with progress bars against your
  targets.
- Optionally log a daily weight; capture starting/ending weight when opening
  and closing a session.
- Close a session to archive it (daily totals are kept; individual meal
  rows are pruned).
- Export the current open session as pretty-printed JSON.

See [`REQUIREMENTS.md`](REQUIREMENTS.md) for the product spec and data model.

## Tech stack

- Node.js 20+ (Express + `better-sqlite3`)
- React 18 + Vite
- TanStack Query for server-state caching on the client
- SQLite single-file database (WAL mode)

No ORM, no auth library. Server state on the client is managed by
TanStack Query; there is no separate client-state library beyond
React's built-ins.

## Quickstart (development)

```bash
git clone <this-repo>
cd personal-calorie-tracker
npm install            # root deps
npm --prefix client install
npm run dev            # server on :8002, Vite client on :5173
```

The Vite dev server proxies `/api/*` to the Express backend, so open
`http://localhost:5173`.

## Tests

```bash
npm test            # backend integration suite (Vitest + supertest, in-memory SQLite)
npm run test:watch  # same, in watch mode
```

The suite is backend-only by design — every invariant that matters (one
open session at a time, `daily_totals` delta math, the 90-day block,
today-only edit window, `ON DELETE SET NULL` on saved-meal links) lives
in the server.

## Lint and format

```bash
npm run lint          # ESLint over server + client
npm run lint:fix      # auto-fix what's auto-fixable
npm run format        # Prettier write across the repo
npm run format:check  # CI-friendly: fail if anything would change
```

ESLint uses flat config (`eslint.config.js`) with separate blocks for
the Node server and the React/JSX client. Prettier (`.prettierrc`) uses
single quotes, `es5` trailing commas, and a 100-char print width. The
two tools don't fight — `eslint-config-prettier` disables ESLint's
stylistic rules.

## Production deploy

For a Raspberry Pi + Tailscale setup (the intended deployment), follow
[`DEPLOYMENT.md`](DEPLOYMENT.md). Short version:

```bash
npm install
npm run build          # bundles the client into client/dist/
npm start              # serves API + static client on :8002
```

`npm start` requires that `npm run build` has been run — Express serves
the bundle at `client/dist/`, and if it's missing every non-`/api` request
returns a placeholder message.

## Configuration

| Variable   | Default  | Purpose                                      |
| ---------- | -------- | -------------------------------------------- |
| `PORT`     | `8002`   | HTTP port the server binds to                |
| `DATA_DIR` | `./data` | Directory holding `tracker.db` and WAL files |

## Repository layout

```
server/          Express app, SQLite schema, route handlers
  index.js       Production entry (initDb + listen)
  app.js         createApp() factory used by index.js and tests
  db.js          Connection setup; delegates schema to migrate.js
  migrate.js     Runs unapplied migrations/*.sql files in order
  migrations/    Versioned schema migrations (NNN_*.sql)
  dates.js       Local-timezone YYYY-MM-DD helpers
  routes/        One file per API resource
  __tests__/     Vitest integration tests + seed helpers
client/          Vite + React frontend
  src/
    pages/       Top-level routes
    components/  Reusable UI
data/            SQLite DB lives here by default (gitignored)
```

See [`CLAUDE.md`](CLAUDE.md) for an architecture overview written for
AI coding assistants — but it's useful for humans too.

## License

To be added.
