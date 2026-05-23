import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { insertSavedMeal } from './helpers/seed.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('GET /api/saved-meals', () => {
  it('returns an empty list when nothing is saved', async () => {
    const res = await request(app).get('/api/saved-meals');
    expect(res.status).toBe(200);
    expect(res.body.savedMeals).toEqual([]);
  });

  it('sorts case-insensitively by name', async () => {
    insertSavedMeal({ name: 'banana' });
    insertSavedMeal({ name: 'Apple' });
    insertSavedMeal({ name: 'cherry' });

    const res = await request(app).get('/api/saved-meals');
    expect(res.body.savedMeals.map((m) => m.name)).toEqual(['Apple', 'banana', 'cherry']);
  });
});

describe('POST /api/saved-meals', () => {
  it('creates a saved meal', async () => {
    const res = await request(app)
      .post('/api/saved-meals')
      .send({ name: 'Oats', calories: 300, protein: 12, carbs: 50, fat: 5 });

    expect(res.status).toBe(201);
    expect(res.body.savedMeal).toMatchObject({
      name: 'Oats',
      calories: 300,
      protein: 12,
      carbs: 50,
      fat: 5
    });
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/saved-meals')
      .send({ calories: 100, protein: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('rejects negative calories', async () => {
    const res = await request(app)
      .post('/api/saved-meals')
      .send({ name: 'X', calories: -1, protein: 5 });
    expect(res.status).toBe(400);
  });

  it('allows omitted carbs and fat (stored as null)', async () => {
    const res = await request(app)
      .post('/api/saved-meals')
      .send({ name: 'Plain', calories: 100, protein: 5 });
    expect(res.body.savedMeal.carbs).toBeNull();
    expect(res.body.savedMeal.fat).toBeNull();
  });
});

describe('PUT /api/saved-meals/:id', () => {
  it('updates a saved meal', async () => {
    const saved = insertSavedMeal({ name: 'Old', calories: 100, protein: 5 });
    const res = await request(app)
      .put(`/api/saved-meals/${saved.id}`)
      .send({ name: 'New', calories: 200, protein: 10 });

    expect(res.status).toBe(200);
    expect(res.body.savedMeal).toMatchObject({ name: 'New', calories: 200, protein: 10 });
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/api/saved-meals/9999')
      .send({ name: 'x', calories: 100, protein: 5 });
    expect(res.status).toBe(404);
  });

  it('returns 400 on validation failure', async () => {
    const saved = insertSavedMeal();
    const res = await request(app)
      .put(`/api/saved-meals/${saved.id}`)
      .send({ name: '', calories: 100, protein: 5 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/saved-meals/:id', () => {
  it('removes a saved meal', async () => {
    const saved = insertSavedMeal();
    const res = await request(app).delete(`/api/saved-meals/${saved.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/api/saved-meals');
    expect(list.body.savedMeals).toHaveLength(0);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/saved-meals/9999');
    expect(res.status).toBe(404);
  });
});
