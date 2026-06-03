import { getDb } from '../../db.js';
import { today, addDays } from '../../dates.js';

export function makeSession({
  startDaysAgo = 0,
  calorie_target = 2000,
  protein_target = 150,
  start_weight_kg = null,
  status = 'open',
  end_date = null,
  end_weight_kg = null,
  phase = 'cut',
} = {}) {
  const db = getDb();
  const start_date = addDays(today(), -startDaysAgo);
  const info = db
    .prepare(
      `INSERT INTO sessions
         (start_date, end_date, calorie_target, protein_target, status,
          start_weight_kg, end_weight_kg, phase)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      start_date,
      end_date,
      calorie_target,
      protein_target,
      status,
      start_weight_kg,
      end_weight_kg,
      phase
    );
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(info.lastInsertRowid);
}

export function insertMeal({
  sessionId,
  date = today(),
  name = 'Test meal',
  calories = 500,
  protein = 30,
  carbs = null,
  fat = null,
  source_saved_meal_id = null,
}) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO meals
         (session_id, date, name, calories, protein, carbs, fat, source_saved_meal_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(sessionId, date, name, calories, protein, carbs, fat, source_saved_meal_id);

  db.prepare(
    `INSERT INTO daily_totals (session_id, date, calories, protein)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, date)
     DO UPDATE SET calories = calories + excluded.calories,
                   protein  = protein  + excluded.protein`
  ).run(sessionId, date, calories, protein);

  return db.prepare(`SELECT * FROM meals WHERE id = ?`).get(info.lastInsertRowid);
}

export function insertSavedMeal({
  name = 'Saved meal',
  calories = 400,
  protein = 25,
  carbs = null,
  fat = null,
  category_id = null,
} = {}) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO saved_meals (name, calories, protein, carbs, fat, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, calories, protein, carbs, fat, category_id);
  return db.prepare(`SELECT * FROM saved_meals WHERE id = ?`).get(info.lastInsertRowid);
}

export function insertCategory({ name = 'Test category' } = {}) {
  const db = getDb();
  const info = db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(name);
  return db.prepare(`SELECT * FROM categories WHERE id = ?`).get(info.lastInsertRowid);
}

export function getDailyTotal(sessionId, date) {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM daily_totals WHERE session_id = ? AND date = ?`)
    .get(sessionId, date);
}

export function getMealRow(id) {
  const db = getDb();
  return db.prepare(`SELECT * FROM meals WHERE id = ?`).get(id);
}
