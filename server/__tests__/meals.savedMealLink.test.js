import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { makeSession, insertMeal, insertSavedMeal, getMealRow } from './helpers/seed.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('saved meal deletion → ON DELETE SET NULL on meals', () => {
  it('keeps the historical meal row but clears source_saved_meal_id', async () => {
    const session = makeSession();
    const saved = insertSavedMeal({ name: 'Yogurt', calories: 150, protein: 10 });
    const meal = insertMeal({
      sessionId: session.id,
      name: 'Yogurt',
      calories: 150,
      protein: 10,
      source_saved_meal_id: saved.id,
    });

    expect(getMealRow(meal.id).source_saved_meal_id).toBe(saved.id);

    const res = await request(app).delete(`/api/saved-meals/${saved.id}`);
    expect(res.status).toBe(204);

    const after = getMealRow(meal.id);
    expect(after).toBeDefined();
    expect(after.source_saved_meal_id).toBeNull();
    expect(after.name).toBe('Yogurt');
    expect(after.calories).toBe(150);
  });

  it('does not affect meals whose source_saved_meal_id points elsewhere', async () => {
    const session = makeSession();
    const a = insertSavedMeal({ name: 'A' });
    const b = insertSavedMeal({ name: 'B' });
    const mealA = insertMeal({ sessionId: session.id, source_saved_meal_id: a.id });
    const mealB = insertMeal({ sessionId: session.id, source_saved_meal_id: b.id });

    await request(app).delete(`/api/saved-meals/${a.id}`);

    expect(getMealRow(mealA.id).source_saved_meal_id).toBeNull();
    expect(getMealRow(mealB.id).source_saved_meal_id).toBe(b.id);
  });

  it('updating a saved meal does not mutate historical meal rows', async () => {
    const session = makeSession();
    const saved = insertSavedMeal({ name: 'Oats', calories: 300, protein: 12 });
    const meal = insertMeal({
      sessionId: session.id,
      name: 'Oats',
      calories: 300,
      protein: 12,
      source_saved_meal_id: saved.id,
    });

    await request(app)
      .put(`/api/saved-meals/${saved.id}`)
      .send({ name: 'Oats v2', calories: 500, protein: 25 });

    const after = getMealRow(meal.id);
    expect(after.name).toBe('Oats');
    expect(after.calories).toBe(300);
    expect(after.protein).toBe(12);
    expect(after.source_saved_meal_id).toBe(saved.id);
  });
});
