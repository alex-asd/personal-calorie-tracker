import express from 'express';
import { getDb } from '../db.js';
import { today, daysBetween, validateSessionDate } from '../dates.js';

const router = express.Router();
const MAX_DAYS = 90;
const BLOCKED_ERROR = 'session has exceeded 90 days; close it to log weight';

function getOpenSession(db) {
  return db.prepare(`SELECT * FROM sessions WHERE status = 'open' LIMIT 1`).get();
}

function isBlocked(session) {
  if (!session) return true;
  const dayNumber = daysBetween(session.start_date, today()) + 1;
  return dayNumber > MAX_DAYS;
}

router.get('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const weights = db
    .prepare(`SELECT date, weight_kg FROM daily_weights WHERE session_id = ? ORDER BY date ASC`)
    .all(session.id);

  res.json({
    session_id: session.id,
    start_date: session.start_date,
    start_weight_kg: session.start_weight_kg,
    goal_weight_kg: session.goal_weight_kg,
    weights,
  });
});

router.get('/today', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const row = db
    .prepare(`SELECT date, weight_kg FROM daily_weights WHERE session_id = ? AND date = ?`)
    .get(session.id, today());
  res.json({ weight: row || null });
});

router.post('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) {
    return res.status(403).json({ error: BLOCKED_ERROR });
  }

  const w = Number(req.body?.weight_kg);
  if (!Number.isFinite(w) || w <= 0) {
    return res.status(400).json({ error: 'weight_kg must be a positive number' });
  }

  const date = today();
  const existing = db
    .prepare(`SELECT date FROM daily_weights WHERE session_id = ? AND date = ?`)
    .get(session.id, date);
  if (existing) {
    return res
      .status(409)
      .json({ error: 'weight already logged for today; delete it first to re-log' });
  }

  db.prepare(`INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)`).run(
    session.id,
    date,
    w
  );

  const row = db
    .prepare(`SELECT date, weight_kg FROM daily_weights WHERE session_id = ? AND date = ?`)
    .get(session.id, date);
  res.status(201).json({ weight: row });
});

// Log or correct the weight for any day of the open session (start_date..today).
// Upsert semantics: 201 when created, 200 when an existing entry was replaced.
router.put('/:date', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) return res.status(403).json({ error: BLOCKED_ERROR });

  const parsed = validateSessionDate(session, req.params.date, 'weight');
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const w = Number(req.body?.weight_kg);
  if (!Number.isFinite(w) || w <= 0) {
    return res.status(400).json({ error: 'weight_kg must be a positive number' });
  }

  const existed = db
    .prepare(`SELECT 1 FROM daily_weights WHERE session_id = ? AND date = ?`)
    .get(session.id, parsed.date);
  db.prepare(
    `INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)
     ON CONFLICT(session_id, date) DO UPDATE SET weight_kg = excluded.weight_kg`
  ).run(session.id, parsed.date, w);

  const row = db
    .prepare(`SELECT date, weight_kg FROM daily_weights WHERE session_id = ? AND date = ?`)
    .get(session.id, parsed.date);
  res.status(existed ? 200 : 201).json({ weight: row });
});

router.delete('/today', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const info = db
    .prepare(`DELETE FROM daily_weights WHERE session_id = ? AND date = ?`)
    .run(session.id, today());
  if (info.changes === 0) {
    return res.status(404).json({ error: 'no weight logged for today' });
  }
  res.status(204).end();
});

// Clear the weight for any day. Mounted after `/today` so that literal wins.
router.delete('/:date', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const parsed = validateSessionDate(session, req.params.date, 'weight');
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const info = db
    .prepare(`DELETE FROM daily_weights WHERE session_id = ? AND date = ?`)
    .run(session.id, parsed.date);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'no weight logged for that day' });
  }
  res.status(204).end();
});

export default router;
