import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();

function parseName(body) {
  const name = String(body?.name ?? '').trim();
  if (!name) return { error: 'name is required' };
  return { name };
}

router.get('/', (req, res) => {
  const db = getDb();
  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.created_at,
              (SELECT COUNT(*) FROM saved_meals s WHERE s.category_id = c.id) AS meal_count
       FROM categories c
       ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all();
  res.json({ categories });
});

router.post('/', (req, res) => {
  const db = getDb();
  const parsed = parseName(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const existing = db
    .prepare(`SELECT id FROM categories WHERE name = ? COLLATE NOCASE`)
    .get(parsed.name);
  if (existing) {
    return res.status(409).json({ error: 'a category with that name already exists' });
  }

  const info = db.prepare(`INSERT INTO categories (name) VALUES (?)`).run(parsed.name);
  const category = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ category });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'category not found' });

  const parsed = parseName(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const dupe = db
    .prepare(`SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?`)
    .get(parsed.name, id);
  if (dupe) {
    return res.status(409).json({ error: 'a category with that name already exists' });
  }

  db.prepare(`UPDATE categories SET name = ? WHERE id = ?`).run(parsed.name, id);
  const category = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
  res.json({ category });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT id FROM categories WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'category not found' });

  // saved_meals.category_id is ON DELETE SET NULL, so meals fall back to Uncategorized.
  db.prepare(`DELETE FROM categories WHERE id = ?`).run(id);
  res.status(204).end();
});

export default router;
