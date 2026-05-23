import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function getDb() {
  if (!db) initDb();
  return db;
}

function resolveDefaultDbPath() {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'tracker.db');
}

export function initDb({ dbPath } = {}) {
  const target = dbPath || resolveDefaultDbPath();

  if (db) db.close();
  db = new Database(target);
  if (target !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      start_date TEXT NOT NULL,
      end_date TEXT,
      calorie_target INTEGER NOT NULL,
      protein_target INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open','closed')) DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_meals (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL,
      fat REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL,
      fat REAL,
      source_saved_meal_id INTEGER REFERENCES saved_meals(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_meals_session_date ON meals(session_id, date);

    CREATE TABLE IF NOT EXISTS daily_totals (
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      protein REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_weights (
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (session_id, date)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session
      ON sessions(status) WHERE status = 'open';
  `);

  const sessionCols = new Set(
    db.prepare(`PRAGMA table_info(sessions)`).all().map((c) => c.name)
  );
  if (!sessionCols.has('start_weight_kg')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN start_weight_kg REAL`);
  }
  if (!sessionCols.has('end_weight_kg')) {
    db.exec(`ALTER TABLE sessions ADD COLUMN end_weight_kg REAL`);
  }

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
