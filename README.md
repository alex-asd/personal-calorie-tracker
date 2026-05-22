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
- SQLite single-file database (WAL mode)

No ORM, no auth library, no client state library beyond a single React
context.

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

There is no test suite, linter, or formatter.

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

| Variable   | Default   | Purpose                                       |
| ---------- | --------- | --------------------------------------------- |
| `PORT`     | `8002`    | HTTP port the server binds to                 |
| `DATA_DIR` | `./data`  | Directory holding `tracker.db` and WAL files  |

## Repository layout

```
server/          Express app, SQLite schema, route handlers
  index.js       Entry point
  db.js          Schema + migrations
  dates.js       Local-timezone YYYY-MM-DD helpers
  routes/        One file per API resource
client/          Vite + React frontend
  src/
    pages/       Top-level routes
    components/  Reusable UI
data/            SQLite DB lives here by default (gitignored)
```

See [`CLAUDE.md`](CLAUDE.md) for an architecture overview written for
AI coding assistants — but it's useful for humans too.

## License

[MIT](LICENSE).
