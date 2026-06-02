import express from 'express';
import { getDb } from '../db.js';
import { today, daysBetween } from '../dates.js';

const router = express.Router();
const MAX_DAYS = 90;

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
    return res.status(403).json({ error: 'session has exceeded 90 days; close it to log weight' });
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

export default router;
