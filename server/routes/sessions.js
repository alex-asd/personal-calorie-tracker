import express from 'express';
import { getDb } from '../db.js';
import { today, daysBetween, addDays } from '../dates.js';

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
  const { calorie_target, protein_target, start_weight_kg } = req.body ?? {};

  const calories = Number(calorie_target);
  const protein = Number(protein_target);

  if (!Number.isFinite(calories) || calories <= 0) {
    return res.status(400).json({ error: 'calorie_target must be a positive number' });
  }
  if (!Number.isFinite(protein) || protein <= 0) {
    return res.status(400).json({ error: 'protein_target must be a positive number' });
  }

  let startWeight = null;
  if (start_weight_kg !== undefined && start_weight_kg !== null && start_weight_kg !== '') {
    const w = Number(start_weight_kg);
    if (!Number.isFinite(w) || w <= 0) {
      return res.status(400).json({ error: 'start_weight_kg must be a positive number' });
    }
    startWeight = w;
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
      `INSERT INTO sessions (start_date, calorie_target, protein_target, status, start_weight_kg)
       VALUES (?, ?, ?, 'open', ?)`
    )
    .run(today(), Math.round(calories), Math.round(protein), startWeight);

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

  let endWeight = null;
  const raw = req.body?.end_weight_kg;
  if (raw !== undefined && raw !== null && raw !== '') {
    const w = Number(raw);
    if (!Number.isFinite(w) || w <= 0) {
      return res.status(400).json({ error: 'end_weight_kg must be a positive number' });
    }
    endWeight = w;
  }

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM meals WHERE session_id = ?`).run(id);
    db.prepare(`DELETE FROM daily_weights WHERE session_id = ?`).run(id);
    db.prepare(
      `UPDATE sessions SET status = 'closed', end_date = ?, end_weight_kg = ? WHERE id = ?`
    ).run(today(), endWeight, id);
  });
  tx();

  const updated = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  res.json({ session: updated });
});

router.get('/', (req, res) => {
  const db = getDb();
  const sessions = db
    .prepare(
      `SELECT * FROM sessions WHERE status = 'closed' ORDER BY end_date DESC, id DESC`
    )
    .all();
  for (const s of sessions) {
    s.day_count = daysBetween(s.start_date, s.end_date) + 1;
  }
  res.json({ sessions });
});

router.get('/:id/days', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid session id' });
  }

  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  if (!session) return res.status(404).json({ error: 'session not found' });

  const endDate = session.end_date || today();
  const rows = db
    .prepare(`SELECT date, calories, protein FROM daily_totals WHERE session_id = ?`)
    .all(id);
  const byDate = new Map(rows.map((r) => [r.date, r]));

  const days = [];
  let cursor = endDate;
  while (cursor >= session.start_date) {
    const row = byDate.get(cursor);
    days.push({
      date: cursor,
      calories: row ? row.calories : 0,
      protein: row ? row.protein : 0
    });
    cursor = addDays(cursor, -1);
  }

  res.json({
    sessionId: id,
    startDate: session.start_date,
    endDate: session.end_date,
    days
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
  if (!session) return res.status(404).json({ error: 'session not found' });

  res.json({ session });
});

export default router;
