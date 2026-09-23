import express from 'express';
import { getDb } from '../db.js';
import { today, daysBetween, validateSessionDate } from '../dates.js';

// One running total per (session, day, activity) in `daily_activities`.
// POST adds to the day's total (logging a set), PUT replaces it (correcting,
// or copying a step count off a watch), DELETE clears it.
const router = express.Router();
const MAX_DAYS = 90;
const BLOCKED_ERROR = 'session has exceeded 90 days; close it to log activities';

function getOpenSession(db) {
  return db.prepare(`SELECT * FROM sessions WHERE status = 'open' LIMIT 1`).get();
}

function isBlocked(session) {
  if (!session) return true;
  const dayNumber = daysBetween(session.start_date, today()) + 1;
  return dayNumber > MAX_DAYS;
}

function parseAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'amount must be a positive number' };
  }
  return { amount };
}

function getLog(db, sessionId, date, activityId) {
  return db
    .prepare(
      `SELECT date, activity_id, amount FROM daily_activities
       WHERE session_id = ? AND date = ? AND activity_id = ?`
    )
    .get(sessionId, date, activityId);
}

router.get('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const date = req.query.date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'invalid date format' });
  }

  const logs = db
    .prepare(
      `SELECT activity_id, amount FROM daily_activities
       WHERE session_id = ? AND date = ? ORDER BY activity_id ASC`
    )
    .all(session.id, date);
  res.json({ date, logs });
});

// Add `amount` to the day's total for `activity_id` (creating it if needed).
// `date` defaults to today. 201 when the day's row is created, 200 when added to.
router.post('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) return res.status(403).json({ error: BLOCKED_ERROR });

  const parsedDate = validateSessionDate(session, req.body?.date, 'activities');
  if (parsedDate.error) return res.status(400).json({ error: parsedDate.error });
  const { date } = parsedDate;

  const activityId = Number(req.body?.activity_id);
  if (!Number.isInteger(activityId)) {
    return res.status(400).json({ error: 'activity_id must be an integer' });
  }
  if (!db.prepare(`SELECT id FROM activities WHERE id = ?`).get(activityId)) {
    return res.status(400).json({ error: 'activity not found' });
  }

  const parsed = parseAmount(req.body?.amount);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const existed = Boolean(getLog(db, session.id, date, activityId));
  db.prepare(
    `INSERT INTO daily_activities (session_id, date, activity_id, amount) VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, date, activity_id) DO UPDATE SET amount = amount + excluded.amount`
  ).run(session.id, date, activityId, parsed.amount);

  res.status(existed ? 200 : 201).json({ log: getLog(db, session.id, date, activityId) });
});

// Replace the day's total. Upsert: 201 when created, 200 when replaced.
router.put('/:date/:activityId', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) return res.status(403).json({ error: BLOCKED_ERROR });

  const parsedDate = validateSessionDate(session, req.params.date, 'activities');
  if (parsedDate.error) return res.status(400).json({ error: parsedDate.error });
  const { date } = parsedDate;

  const activityId = Number(req.params.activityId);
  if (!Number.isInteger(activityId)) return res.status(400).json({ error: 'invalid activity id' });
  if (!db.prepare(`SELECT id FROM activities WHERE id = ?`).get(activityId)) {
    return res.status(404).json({ error: 'activity not found' });
  }

  const parsed = parseAmount(req.body?.amount);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const existed = Boolean(getLog(db, session.id, date, activityId));
  db.prepare(
    `INSERT INTO daily_activities (session_id, date, activity_id, amount) VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, date, activity_id) DO UPDATE SET amount = excluded.amount`
  ).run(session.id, date, activityId, parsed.amount);

  res.status(existed ? 200 : 201).json({ log: getLog(db, session.id, date, activityId) });
});

router.delete('/:date/:activityId', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) return res.status(403).json({ error: BLOCKED_ERROR });

  const parsedDate = validateSessionDate(session, req.params.date, 'activities');
  if (parsedDate.error) return res.status(400).json({ error: parsedDate.error });

  const activityId = Number(req.params.activityId);
  if (!Number.isInteger(activityId)) return res.status(400).json({ error: 'invalid activity id' });

  const info = db
    .prepare(`DELETE FROM daily_activities WHERE session_id = ? AND date = ? AND activity_id = ?`)
    .run(session.id, parsedDate.date, activityId);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'nothing logged for that activity on that day' });
  }
  res.status(204).end();
});

export default router;
