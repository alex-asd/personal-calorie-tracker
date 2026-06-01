import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

function parse(body) {
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

  let categoryId = null;
  if (body?.category_id !== undefined && body?.category_id !== null && body?.category_id !== '') {
    categoryId = Number(body.category_id);
    if (!Number.isInteger(categoryId)) {
      return { error: 'category_id must be an integer' };
    }
  }

  return { values: { name, calories, protein, carbs, fat, categoryId } };
}

// Returns true when categoryId is null or references an existing category.
function categoryExists(db, categoryId) {
  if (categoryId == null) return true;
  return Boolean(db.prepare(`SELECT id FROM categories WHERE id = ?`).get(categoryId));
}

router.get('/', (req, res) => {
  const db = getDb();
  const savedMeals = db.prepare(`SELECT * FROM saved_meals ORDER BY name COLLATE NOCASE ASC`).all();
  res.json({ savedMeals });
});

router.post('/', (req, res) => {
  const db = getDb();
  const parsed = parse(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, calories, protein, carbs, fat, categoryId } = parsed.values;

  if (!categoryExists(db, categoryId)) {
    return res.status(400).json({ error: 'category not found' });
  }

  const info = db
    .prepare(
      `INSERT INTO saved_meals (name, calories, protein, carbs, fat, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, calories, protein, carbs, fat, categoryId);

  const savedMeal = db.prepare(`SELECT * FROM saved_meals WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ savedMeal });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT id FROM saved_meals WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'saved meal not found' });

  const parsed = parse(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, calories, protein, carbs, fat, categoryId } = parsed.values;

  if (!categoryExists(db, categoryId)) {
    return res.status(400).json({ error: 'category not found' });
  }

  db.prepare(
    `UPDATE saved_meals
       SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ?, category_id = ?
     WHERE id = ?`
  ).run(name, calories, protein, carbs, fat, categoryId, id);

  const updated = db.prepare(`SELECT * FROM saved_meals WHERE id = ?`).get(id);
  res.json({ savedMeal: updated });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT id FROM saved_meals WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'saved meal not found' });

  db.prepare(`DELETE FROM saved_meals WHERE id = ?`).run(id);
  res.status(204).end();
});

export default router;
