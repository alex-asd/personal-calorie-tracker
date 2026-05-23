import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runMigrations } from './migrate.js';

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

  runMigrations(db);

  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
