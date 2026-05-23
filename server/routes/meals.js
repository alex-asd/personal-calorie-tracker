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

function parseNutrition(body) {
  const name = String(body?.name ?? '').trim();
  if (!name) return { error: 'name is required' };

  const calories = Number(body?.calories);
  if (!Number.isFinite(calories) || calories < 0) {
    return { error: 'calories must be a non-negative number' };
  }

  const protein = Number(body?.protein);
  if (!Number.isFinite(protein) || protein < 0) {
    return { error: 'protein must be a non-negative number' };
  }

  let carbs = null;
  if (body?.carbs !== undefined && body?.carbs !== null && body?.carbs !== '') {
    carbs = Number(body.carbs);
    if (!Number.isFinite(carbs) || carbs < 0) {
      return { error: 'carbs must be a non-negative number' };
    }
  }

  let fat = null;
  if (body?.fat !== undefined && body?.fat !== null && body?.fat !== '') {
    fat = Number(body.fat);
    if (!Number.isFinite(fat) || fat < 0) {
      return { error: 'fat must be a non-negative number' };
    }
  }

  return { values: { name, calories, protein, carbs, fat } };
}

router.get('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const date = req.query.date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'invalid date format' });
  }

  const meals = db
    .prepare(
      `SELECT * FROM meals WHERE session_id = ? AND date = ? ORDER BY created_at ASC, id ASC`
    )
    .all(session.id, date);

  res.json({ meals, date });
});

router.post('/', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });
  if (isBlocked(session)) {
    return res
      .status(403)
      .json({ error: 'session has exceeded 90 days; close it to log new meals' });
  }

  const parsed = parseNutrition(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, calories, protein, carbs, fat } = parsed.values;

  const saveToLibrary = Boolean(req.body?.save_to_library);
  const sourceSavedMealId =
    req.body?.source_saved_meal_id != null ? Number(req.body.source_saved_meal_id) : null;

  const date = today();

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO meals (session_id, date, name, calories, protein, carbs, fat, source_saved_meal_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(session.id, date, name, calories, protein, carbs, fat, sourceSavedMealId);

    db.prepare(
      `INSERT INTO daily_totals (session_id, date, calories, protein)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id, date)
       DO UPDATE SET calories = calories + excluded.calories,
                     protein  = protein  + excluded.protein`
    ).run(session.id, date, calories, protein);

    let savedMeal = null;
    if (saveToLibrary && !sourceSavedMealId) {
      const s = db
        .prepare(
          `INSERT INTO saved_meals (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)`
        )
        .run(name, calories, protein, carbs, fat);
      savedMeal = db.prepare(`SELECT * FROM saved_meals WHERE id = ?`).get(s.lastInsertRowid);
    }

    return { mealId: info.lastInsertRowid, savedMeal };
  });

  const { mealId, savedMeal } = tx();
  const meal = db.prepare(`SELECT * FROM meals WHERE id = ?`).get(mealId);
  res.status(201).json({ meal, savedMeal });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid meal id' });

  const meal = db
    .prepare(`SELECT * FROM meals WHERE id = ? AND session_id = ?`)
    .get(id, session.id);
  if (!meal) return res.status(404).json({ error: 'meal not found' });
  if (meal.date !== today()) {
    return res.status(403).json({ error: 'cannot edit meals from earlier days' });
  }
  if (isBlocked(session)) {
    return res.status(403).json({ error: 'session has exceeded 90 days' });
  }

  const parsed = parseNutrition(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, calories, protein, carbs, fat } = parsed.values;

  const dCalories = calories - meal.calories;
  const dProtein = protein - meal.protein;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE meals SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?`
    ).run(name, calories, protein, carbs, fat, id);

    db.prepare(
      `UPDATE daily_totals SET calories = calories + ?, protein = protein + ?
       WHERE session_id = ? AND date = ?`
    ).run(dCalories, dProtein, session.id, meal.date);
  });
  tx();

  const updated = db.prepare(`SELECT * FROM meals WHERE id = ?`).get(id);
  res.json({ meal: updated });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const session = getOpenSession(db);
  if (!session) return res.status(404).json({ error: 'no open session' });

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid meal id' });

  const meal = db
    .prepare(`SELECT * FROM meals WHERE id = ? AND session_id = ?`)
    .get(id, session.id);
  if (!meal) return res.status(404).json({ error: 'meal not found' });
  if (meal.date !== today()) {
    return res.status(403).json({ error: 'cannot delete meals from earlier days' });
  }

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM meals WHERE id = ?`).run(id);
    db.prepare(
      `UPDATE daily_totals SET calories = calories - ?, protein = protein - ?
       WHERE session_id = ? AND date = ?`
    ).run(meal.calories, meal.protein, session.id, meal.date);
  });
  tx();

  res.status(204).end();
});

export default router;
