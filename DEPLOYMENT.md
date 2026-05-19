# Deployment

This guide is for running the tracker on a Raspberry Pi behind Tailscale.
There is no authentication built in — access control is delegated to your
tailnet.

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

Server listens on `http://0.0.0.0:3000`. From another machine on your
tailnet, open one of:

- `http://<pi-hostname>:3000` (e.g. `http://raspberrypi:3000` if MagicDNS is on)
- `http://<pi-tailscale-ip>:3000`

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
Environment=PORT=3000
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

| Variable   | Default   | Purpose                                      |
| ---------- | --------- | -------------------------------------------- |
| `PORT`     | `3000`    | HTTP port the server binds to                |
| `DATA_DIR` | `./data`  | Directory holding `tracker.db` and WAL files |

## Tailscale access

The server binds to `0.0.0.0:3000`, so it's reachable on any interface the
Pi has. With Tailscale running, that includes the tailnet — no port
forwarding required.

Optional: drop the `:3000` from the URL and add TLS via Tailscale Serve:

```bash
sudo tailscale serve --bg http://localhost:3000
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
