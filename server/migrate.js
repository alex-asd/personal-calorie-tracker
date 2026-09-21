import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Schema probes for the migrations that shipped before (or alongside) the
// runner. Each answers "are this file's effects already present?" so a
// database created under the old inline-schema regime can be brought to head
// without re-running DDL it already has — and without skipping DDL it lacks.
// New migrations (006+) only ever run through the runner and need no probe.
const LEGACY_PROBES = {
  '001_initial.sql': (db) => hasTable(db, 'sessions'),
  '002_session_weight.sql': (db) => hasColumn(db, 'sessions', 'start_weight_kg'),
  '003_meal_categories.sql': (db) => hasTable(db, 'categories'),
  '004_session_goal_weight.sql': (db) => hasColumn(db, 'sessions', 'goal_weight_kg'),
  '005_session_phase.sql': (db) => hasColumn(db, 'sessions', 'phase'),
};

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

  // Transition from the pre-runner schema: _migrations is empty but the
  // canonical tables already exist. Fires at most once per database.
  const legacy = applied.size === 0 && hasTable(db, 'sessions');

  for (const file of files) {
    const probe = LEGACY_PROBES[file];

    if (applied.has(file)) {
      // Repair: an earlier runner recorded every probe-able file as applied
      // on legacy databases even when their DDL had never run. If the schema
      // says the effects are missing, run the file now.
      if (!probe || probe(db)) continue;
      db.transaction(() => {
        db.exec(readMigration(file));
      })();
      continue;
    }

    if (legacy && probe && probe(db)) {
      record.run(file);
      continue;
    }

    db.transaction(() => {
      db.exec(readMigration(file));
      record.run(file);
    })();
  }
}

function readMigration(file) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
}

function hasTable(db, name) {
  const row = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(name);
  return Boolean(row);
}

function hasColumn(db, table, column) {
  if (!hasTable(db, table)) return false;
  return db.pragma(`table_info(${table})`).some((c) => c.name === column);
}
