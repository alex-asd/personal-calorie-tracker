import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { insertCategory, insertSavedMeal } from './helpers/seed.js';
import { getDb } from '../db.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('GET /api/categories', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([]);
  });

  it('sorts case-insensitively and includes a meal_count', async () => {
    const breakfast = insertCategory({ name: 'Breakfast' });
    insertCategory({ name: 'almonds' });
    insertSavedMeal({ name: 'Oats', category_id: breakfast.id });
    insertSavedMeal({ name: 'Eggs', category_id: breakfast.id });

    const res = await request(app).get('/api/categories');
    expect(res.body.categories.map((c) => c.name)).toEqual(['almonds', 'Breakfast']);
    const bf = res.body.categories.find((c) => c.name === 'Breakfast');
    expect(bf.meal_count).toBe(2);
  });
});

describe('POST /api/categories', () => {
  it('creates a category', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Snacks' });
    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({ name: 'Snacks' });
  });

  it('rejects a blank name', async () => {
    const res = await request(app).post('/api/categories').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('rejects a duplicate name (case-insensitive)', async () => {
    insertCategory({ name: 'Lunch' });
    const res = await request(app).post('/api/categories').send({ name: 'lunch' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

describe('PUT /api/categories/:id', () => {
  it('renames a category', async () => {
    const cat = insertCategory({ name: 'Old' });
    const res = await request(app).put(`/api/categories/${cat.id}`).send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('New');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/categories/9999').send({ name: 'x' });
    expect(res.status).toBe(404);
  });

  it('rejects renaming onto an existing name', async () => {
    insertCategory({ name: 'Breakfast' });
    const lunch = insertCategory({ name: 'Lunch' });
    const res = await request(app).put(`/api/categories/${lunch.id}`).send({ name: 'breakfast' });
    expect(res.status).toBe(409);
  });

  it('allows renaming a category to its own name (different case)', async () => {
    const cat = insertCategory({ name: 'Lunch' });
    const res = await request(app).put(`/api/categories/${cat.id}`).send({ name: 'LUNCH' });
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('LUNCH');
  });

  it('returns 400 for a non-integer id', async () => {
    const res = await request(app).put('/api/categories/abc').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/categories/:id', () => {
  it('deletes the category and sets its meals back to Uncategorized', async () => {
    const cat = insertCategory({ name: 'Breakfast' });
    const meal = insertSavedMeal({ name: 'Oats', category_id: cat.id });

    const res = await request(app).delete(`/api/categories/${cat.id}`);
    expect(res.status).toBe(204);

    const row = getDb().prepare(`SELECT category_id FROM saved_meals WHERE id = ?`).get(meal.id);
    expect(row.category_id).toBeNull();

    const list = await request(app).get('/api/categories');
    expect(list.body.categories).toHaveLength(0);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/categories/9999');
    expect(res.status).toBe(404);
  });

  it('returns 400 for a non-integer id', async () => {
    const res = await request(app).delete('/api/categories/abc');
    expect(res.status).toBe(400);
  });
});
