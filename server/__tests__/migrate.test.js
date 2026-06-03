import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrate.js';
import { closeDb } from '../db.js';

let db;

beforeEach(() => {
  closeDb();
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
});

afterEach(() => {
  db.close();
});

const EXPECTED_FILES = [
  '001_initial.sql',
  '002_session_weight.sql',
  '003_meal_categories.sql',
  '004_session_goal_weight.sql',
  '005_session_phase.sql',
];

describe('runMigrations on a fresh database', () => {
  it('applies every migration file in order and records each in _migrations', () => {
    runMigrations(db);

    const applied = db.prepare(`SELECT name FROM _migrations ORDER BY name`).all();
    expect(applied.map((r) => r.name)).toEqual(EXPECTED_FILES);
  });

  it('creates the canonical set of tables', () => {
    runMigrations(db);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all()
      .map((r) => r.name);

    for (const t of [
      'sessions',
      'meals',
      'saved_meals',
      'daily_totals',
      'daily_weights',
      'categories',
      '_migrations',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('adds every session column the later migrations introduce', () => {
    runMigrations(db);

    const cols = db
      .prepare(`PRAGMA table_info(sessions)`)
      .all()
      .map((c) => c.name);

    expect(cols).toEqual(
      expect.arrayContaining(['start_weight_kg', 'end_weight_kg', 'goal_weight_kg', 'phase'])
    );
  });

  it('enforces the at-most-one-open-session partial unique index', () => {
    runMigrations(db);

    const insert = db.prepare(
      `INSERT INTO sessions (start_date, calorie_target, protein_target, status, phase)
       VALUES (?, ?, ?, 'open', 'cut')`
    );
    insert.run('2026-01-01', 2000, 150);
    expect(() => insert.run('2026-02-01', 2000, 150)).toThrow();
  });
});

describe('runMigrations is idempotent', () => {
  it('does not double-apply when called twice', () => {
    runMigrations(db);
    runMigrations(db);

    const count = db.prepare(`SELECT COUNT(*) AS n FROM _migrations`).get().n;
    expect(count).toBe(EXPECTED_FILES.length);
  });
});

describe('legacy schema short-circuit', () => {
  it('records all migrations as applied without re-running them when sessions exists and _migrations is empty', () => {
    // Bring the DB up to head, then wipe _migrations to mimic a pre-runner
    // production database that already has the canonical schema.
    runMigrations(db);
    db.exec(`DELETE FROM _migrations`);

    // Re-running must NOT throw — if the runner actually re-ran the ALTERs,
    // SQLite would error with "duplicate column name".
    expect(() => runMigrations(db)).not.toThrow();

    const applied = db
      .prepare(`SELECT name FROM _migrations ORDER BY name`)
      .all()
      .map((r) => r.name);
    expect(applied).toEqual(EXPECTED_FILES);

    // Schema should be untouched (still includes the columns from later migrations).
    const cols = db
      .prepare(`PRAGMA table_info(sessions)`)
      .all()
      .map((c) => c.name);
    expect(cols).toContain('phase');
    expect(cols).toContain('goal_weight_kg');
  });
});
