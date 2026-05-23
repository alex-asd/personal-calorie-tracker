# Deployment

This guide is for running the tracker on a Raspberry Pi behind Tailscale.
There is no authentication built in — access control is delegated to your
tailnet.

> ## ⚠️ Do not expose this to the public internet
>
> The server binds `0.0.0.0:8002` and has **no authentication by default,
> no rate limiting, and no CSRF protection**. Anyone who can reach the
> port has full read/write access to your data.
>
> Safe deployments:
>
> - On a Raspberry Pi joined to your Tailscale tailnet (intended setup).
> - On a host with a firewall that allows only your tailnet/LAN.
>
> Unsafe deployments:
>
> - A VPS with the port open to the internet.
> - A router with port-forwarding to the Pi.
> - Any cloud environment where `0.0.0.0` ends up reachable from outside.
>
> If you must deploy somewhere others can reach, at minimum set
> `TRACKER_PASSWORD` to enable HTTP Basic Auth (see
> [Optional: enable HTTP Basic Auth](#optional-enable-http-basic-auth))
> **and** put TLS in front of the service. For anything beyond a single
> trusted user, fork and add real auth before deploying.

## Prerequisites

- Node.js 20 or later (`node --version`).
- Tailscale running on the Pi and joined to your tailnet.
- `git` if you plan to clone the repo (optional).

`better-sqlite3` ships a prebuilt native binary for ARM, so you don't need
to install system SQLite or a C toolchain.

## Install

```bash
# Pick a project location
sudo mkdir -p /opt/calorie-tracker
sudo chown $USER:$USER /opt/calorie-tracker
cd /opt
git clone <your-repo-url> calorie-tracker
cd calorie-tracker

# Install root deps + client deps + build the client
npm install
npm run build
```

`npm run build` runs `npm install` inside `client/` and produces the static
bundle at `client/dist/`. Express serves it automatically on any request
that isn't `/api/*`.

## First run

```bash
npm start
```

Server listens on `http://0.0.0.0:8002`. From another machine on your
tailnet, open one of:

- `http://<pi-hostname>:8002` (e.g. `http://raspberrypi:8002` if MagicDNS is on)
- `http://<pi-tailscale-ip>:8002`

Stop with Ctrl+C. Use this to confirm everything works before installing
the service.

## Run as a systemd service

Create `/etc/systemd/system/calorie-tracker.service`:

```ini
[Unit]
Description=Personal calorie & nutrition tracker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/calorie-tracker
Environment=NODE_ENV=production
Environment=PORT=8002
Environment=DATA_DIR=/var/lib/calorie-tracker
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Adjust:

- `User` — whatever account owns the project files.
- `WorkingDirectory` — wherever you cloned the repo.
- `ExecStart` — `which node` will tell you the right path (nvm and snap
  installs land elsewhere).
- `DATA_DIR` — optional. Drop the line to keep the SQLite file at
  `./data/tracker.db` inside the project directory.

If you set `DATA_DIR` to a path outside the project, create it once:

```bash
sudo mkdir -p /var/lib/calorie-tracker
sudo chown pi:pi /var/lib/calorie-tracker
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now calorie-tracker
systemctl status calorie-tracker
```

## Common operations

```bash
# Follow logs
journalctl -u calorie-tracker -f

# Restart after an update
sudo systemctl restart calorie-tracker

# Stop temporarily
sudo systemctl stop calorie-tracker
```

## Updating

```bash
cd /opt/calorie-tracker
git pull
npm install          # only if root deps changed
npm run build        # rebuilds the client bundle
sudo systemctl restart calorie-tracker
```

Schema changes are picked up automatically on restart: `initDb` runs any
new SQL files in `server/migrations/` that haven't been recorded in the
`_migrations` tracking table. Take a backup (see below) before any update
that ships a migration if you want a clean rollback path — there are no
down migrations.

## Backups

The whole database is a single file. To back it up safely:

```bash
# Option A: stop, copy, start. Always consistent.
sudo systemctl stop calorie-tracker
cp /var/lib/calorie-tracker/tracker.db ~/tracker-backup-$(date +%Y%m%d).db
sudo systemctl start calorie-tracker

# Option B: SQLite online backup, no downtime.
sqlite3 /var/lib/calorie-tracker/tracker.db ".backup '$HOME/tracker-backup-$(date +%Y%m%d).db'"
```

WAL/SHM files (`tracker.db-wal`, `tracker.db-shm`) only exist while the
service is running; they don't need separate backup with either option
above.

## Environment variables

| Variable           | Default  | Purpose                                                                       |
| ------------------ | -------- | ----------------------------------------------------------------------------- |
| `PORT`             | `8002`   | HTTP port the server binds to                                                 |
| `DATA_DIR`         | `./data` | Directory holding `tracker.db` and WAL files                                  |
| `TRACKER_PASSWORD` | unset    | If set, every request requires HTTP Basic Auth. Leave unset for tailnet-only. |

## Optional: enable HTTP Basic Auth

Set `TRACKER_PASSWORD` to require a password on every request. When unset
(the default) behaviour is identical to the original tailnet-only model.

Generate a long random password:

```bash
openssl rand -base64 32
```

Add it to the systemd unit:

```ini
[Service]
...
Environment=TRACKER_PASSWORD=paste-the-output-here
```

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart calorie-tracker
```

To change the password, edit the unit, reload, restart. To disable auth,
remove the line and restart.

**Command-line access** (e.g. downloading the JSON export):

```bash
curl -u anything:"$TRACKER_PASSWORD" http://<pi-hostname>:8002/api/export -o session.json
```

The username is ignored — type anything when a browser prompts.

**Security caveats:**

- HTTP Basic sends the password (base64-encoded, not hashed) on every
  request. Inside a tailnet this is fine — WireGuard encrypts traffic
  end-to-end. **Outside a tailnet, put TLS in front of the service**
  (Caddy, nginx, or `tailscale serve --https`) before setting
  `TRACKER_PASSWORD`, otherwise the password travels in plaintext on
  every hop.
- There is no lockout or rate limiting on failed attempts. A short or
  guessable password can be brute-forced — use the `openssl` command
  above, not a memorable phrase.
- Browsers cache Basic credentials until the tab (sometimes the whole
  browser) closes. There is no app-level "log out" — closing the tab is
  the workaround.

## Tailscale access

The server binds to `0.0.0.0:8002`, so it's reachable on any interface the
Pi has. With Tailscale running, that includes the tailnet — no port
forwarding required.

Optional: drop the `:8002` from the URL and add TLS via Tailscale Serve:

```bash
sudo tailscale serve --bg http://localhost:8002
```

After that the app is reachable at
`https://<pi-magicdns-name>.<tailnet>.ts.net/`. If you prefer to keep the
service only on the tailnet IP, no further config is needed — the listener
is already happy on `0.0.0.0`.

## Troubleshooting

- **`Error: SQLITE_BUSY`** in logs → another process has the DB open.
  Usually means `npm start` was already running when you started the
  service. Stop the stray process.
- **Client renders, but every fetch fails with 404** → the build wasn't
  produced. Run `npm run build`; restart the service.
- **`/api/health` returns 200 but the page is blank** → check the browser
  console; usually a static asset path mismatch caused by serving from a
  reverse proxy with a non-root path. This app expects to be served at
  `/`.
