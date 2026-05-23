import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  const session = db.prepare(`SELECT * FROM sessions WHERE status = 'open' LIMIT 1`).get();
  if (!session) return res.status(404).json({ error: 'no open session to export' });

  const meals = db
    .prepare(
      `SELECT id, session_id, date, name, calories, protein, carbs, fat, source_saved_meal_id, created_at
       FROM meals WHERE session_id = ?
       ORDER BY date ASC, created_at ASC, id ASC`
    )
    .all(session.id);

  const dailyTotals = db
    .prepare(
      `SELECT date, calories, protein FROM daily_totals WHERE session_id = ? ORDER BY date ASC`
    )
    .all(session.id);

  const dailyWeights = db
    .prepare(`SELECT date, weight_kg FROM daily_weights WHERE session_id = ? ORDER BY date ASC`)
    .all(session.id);

  const payload = {
    exported_at: new Date().toISOString(),
    session,
    daily_totals: dailyTotals,
    daily_weights: dailyWeights,
    meals,
  };

  const filename = `tracker-session-${session.id}-${session.start_date}.json`;
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
});

export default router;
