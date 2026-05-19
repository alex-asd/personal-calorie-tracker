import express from 'express';
import { getDb } from '../db.js';
import { today, daysBetween } from '../dates.js';

const router = express.Router();

const MAX_DAYS = 90;

function decorate(session) {
  if (!session) return null;
  if (session.status === 'closed') return session;
  const dayNumber = daysBetween(session.start_date, today()) + 1;
  return {
    ...session,
    dayNumber,
    warning: dayNumber === MAX_DAYS,
    blocked: dayNumber > MAX_DAYS
  };
}

router.get('/current', (req, res) => {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM sessions WHERE status = 'open' LIMIT 1`)
    .get();
  res.json({ session: decorate(row) });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { calorie_target, protein_target } = req.body ?? {};

  const calories = Number(calorie_target);
  const protein = Number(protein_target);

  if (!Number.isFinite(calories) || calories <= 0) {
    return res.status(400).json({ error: 'calorie_target must be a positive number' });
  }
  if (!Number.isFinite(protein) || protein <= 0) {
    return res.status(400).json({ error: 'protein_target must be a positive number' });
  }

  const existing = db
    .prepare(`SELECT id FROM sessions WHERE status = 'open' LIMIT 1`)
    .get();
  if (existing) {
    return res
      .status(409)
      .json({ error: 'An open session already exists. Close it before starting a new one.' });
  }

  const info = db
    .prepare(
      `INSERT INTO sessions (start_date, calorie_target, protein_target, status)
       VALUES (?, ?, ?, 'open')`
    )
    .run(today(), Math.round(calories), Math.round(protein));

  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ session: decorate(session) });
});

router.post('/:id/close', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid session id' });
  }

  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  if (session.status === 'closed') {
    return res.status(409).json({ error: 'session already closed' });
  }

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM meals WHERE session_id = ?`).run(id);
    db.prepare(
      `UPDATE sessions SET status = 'closed', end_date = ? WHERE id = ?`
    ).run(today(), id);
  });
  tx();

  const updated = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  res.json({ session: updated });
});

export default router;
