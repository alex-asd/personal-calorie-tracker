import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => r.name)
  );

  const record = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  // Transition from the pre-runner schema: if _migrations is empty but the
  // canonical tables already exist, the DB is at head — record every file as
  // applied without re-running it. Fires at most once per database, only on
  // the first deploy that ships the runner.
  if (applied.size === 0 && hasLegacySchema(db)) {
    db.transaction(() => {
      for (const file of files) record.run(file);
    })();
    return;
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
  }
}

function hasLegacySchema(db) {
  const row = db
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'`)
    .get();
  return Boolean(row);
}
