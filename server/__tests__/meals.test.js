import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import {
  makeSession,
  insertMeal,
  insertSavedMeal,
  getDailyTotal,
  getMealRow,
} from './helpers/seed.js';
import { today, addDays } from '../dates.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('GET /api/meals', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app).get('/api/meals');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no open session/);
  });

  it("lists today's meals by default", async () => {
    const session = makeSession();
    insertMeal({ sessionId: session.id, name: 'Lunch', calories: 600, protein: 40 });
    insertMeal({
      sessionId: session.id,
      date: addDays(today(), -1),
      name: 'Yesterday',
      calories: 500,
      protein: 30,
    });

    const res = await request(app).get('/api/meals');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today());
    expect(res.body.meals).toHaveLength(1);
    expect(res.body.meals[0].name).toBe('Lunch');
  });

  it('accepts an explicit date query', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const yesterday = addDays(today(), -1);
    insertMeal({ sessionId: session.id, date: yesterday, name: 'Yesterday' });

    const res = await request(app).get(`/api/meals?date=${yesterday}`);
    expect(res.body.meals).toHaveLength(1);
    expect(res.body.meals[0].name).toBe('Yesterday');
  });

  it('rejects malformed date query', async () => {
    makeSession();
    const res = await request(app).get('/api/meals?date=2025/01/01');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/meals', () => {
  it('inserts a meal and bumps daily_totals', async () => {
    const session = makeSession();

    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'Oats', calories: 300, protein: 12 });

    expect(res.status).toBe(201);
    expect(res.body.meal).toMatchObject({
      name: 'Oats',
      calories: 300,
      protein: 12,
      date: today(),
      session_id: session.id,
    });
    expect(getDailyTotal(session.id, today())).toMatchObject({
      calories: 300,
      protein: 12,
    });
  });

  it('accumulates daily_totals across multiple meals', async () => {
    const session = makeSession();

    await request(app).post('/api/meals').send({ name: 'A', calories: 300, protein: 12 });
    await request(app).post('/api/meals').send({ name: 'B', calories: 450, protein: 20 });

    expect(getDailyTotal(session.id, today())).toMatchObject({
      calories: 750,
      protein: 32,
    });
  });

  it('returns 404 when no open session', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5 });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the session has exceeded 90 days', async () => {
    makeSession({ startDaysAgo: 90 });
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/90 days/);
  });

  it('rejects missing name', async () => {
    makeSession();
    const res = await request(app).post('/api/meals').send({ calories: 100, protein: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('rejects negative calories', async () => {
    makeSession();
    const res = await request(app).post('/api/meals').send({ name: 'X', calories: -1, protein: 5 });
    expect(res.status).toBe(400);
  });

  it('persists optional carbs and fat', async () => {
    makeSession();
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5, carbs: 12, fat: 3 });
    expect(res.body.meal.carbs).toBe(12);
    expect(res.body.meal.fat).toBe(3);
  });

  it('creates a saved_meal when save_to_library is true', async () => {
    makeSession();
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'Smoothie', calories: 250, protein: 15, save_to_library: true });
    expect(res.body.savedMeal).toMatchObject({ name: 'Smoothie', calories: 250 });
  });

  it('does not duplicate to library when source_saved_meal_id is set', async () => {
    makeSession();
    const saved = insertSavedMeal({ name: 'Yogurt', calories: 150, protein: 10 });
    const res = await request(app).post('/api/meals').send({
      name: 'Yogurt',
      calories: 150,
      protein: 10,
      source_saved_meal_id: saved.id,
      save_to_library: true,
    });
    expect(res.body.savedMeal).toBeNull();
    expect(res.body.meal.source_saved_meal_id).toBe(saved.id);
  });

  it('logs a meal for an earlier day and bumps that day', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const yesterday = addDays(today(), -1);

    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'Backfill', calories: 400, protein: 25, date: yesterday });

    expect(res.status).toBe(201);
    expect(res.body.meal).toMatchObject({ name: 'Backfill', date: yesterday });
    expect(getDailyTotal(session.id, yesterday)).toMatchObject({ calories: 400, protein: 25 });
    expect(getDailyTotal(session.id, today())).toBeUndefined();
  });

  it('rejects a date before the session start', async () => {
    const session = makeSession({ startDaysAgo: 1 });
    const beforeStart = addDays(session.start_date, -1);
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5, date: beforeStart });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before the session start/);
  });

  it('rejects a future date', async () => {
    makeSession();
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5, date: addDays(today(), 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it('rejects a malformed date', async () => {
    makeSession();
    const res = await request(app)
      .post('/api/meals')
      .send({ name: 'X', calories: 100, protein: 5, date: '2025/01/01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/date format/);
  });
});

describe('PUT /api/meals/:id', () => {
  it('applies the calorie/protein delta to daily_totals', async () => {
    const session = makeSession();
    const meal = insertMeal({
      sessionId: session.id,
      calories: 500,
      protein: 30,
    });
    expect(getDailyTotal(session.id, today())).toMatchObject({ calories: 500, protein: 30 });

    const res = await request(app)
      .put(`/api/meals/${meal.id}`)
      .send({ name: meal.name, calories: 700, protein: 45 });

    expect(res.status).toBe(200);
    expect(getDailyTotal(session.id, today())).toMatchObject({ calories: 700, protein: 45 });
  });

  it('handles a negative delta (reducing calories)', async () => {
    const session = makeSession();
    const meal = insertMeal({
      sessionId: session.id,
      calories: 800,
      protein: 40,
    });

    await request(app)
      .put(`/api/meals/${meal.id}`)
      .send({ name: meal.name, calories: 300, protein: 20 });

    expect(getDailyTotal(session.id, today())).toMatchObject({ calories: 300, protein: 20 });
  });

  it('edits a meal from an earlier day and applies the delta to that day', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const yesterday = addDays(today(), -1);
    const meal = insertMeal({
      sessionId: session.id,
      date: yesterday,
      calories: 500,
      protein: 30,
    });
    expect(getDailyTotal(session.id, yesterday)).toMatchObject({ calories: 500, protein: 30 });

    const res = await request(app)
      .put(`/api/meals/${meal.id}`)
      .send({ name: 'edited', calories: 700, protein: 45 });

    expect(res.status).toBe(200);
    expect(res.body.meal).toMatchObject({ name: 'edited', date: yesterday });
    expect(getDailyTotal(session.id, yesterday)).toMatchObject({ calories: 700, protein: 45 });
  });

  it('returns 403 when editing in a session past 90 days', async () => {
    const session = makeSession({ startDaysAgo: 90 });
    const meal = insertMeal({
      sessionId: session.id,
      date: addDays(today(), -1),
      calories: 500,
      protein: 30,
    });

    const res = await request(app)
      .put(`/api/meals/${meal.id}`)
      .send({ name: 'edited', calories: 100, protein: 5 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/90 days/);
  });

  it('returns 404 for unknown meal id', async () => {
    makeSession();
    const res = await request(app)
      .put('/api/meals/9999')
      .send({ name: 'x', calories: 100, protein: 5 });
    expect(res.status).toBe(404);
  });

  it('returns 404 when no open session', async () => {
    const res = await request(app)
      .put('/api/meals/1')
      .send({ name: 'x', calories: 100, protein: 5 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/meals/:id', () => {
  it('removes the meal and subtracts from daily_totals', async () => {
    const session = makeSession();
    const a = insertMeal({ sessionId: session.id, calories: 500, protein: 30 });
    insertMeal({ sessionId: session.id, calories: 200, protein: 10 });

    const res = await request(app).delete(`/api/meals/${a.id}`);

    expect(res.status).toBe(204);
    expect(getMealRow(a.id)).toBeUndefined();
    expect(getDailyTotal(session.id, today())).toMatchObject({ calories: 200, protein: 10 });
  });

  it('leaves daily_totals row at zero (does not remove it) when deleting the last meal', async () => {
    const session = makeSession();
    const meal = insertMeal({ sessionId: session.id, calories: 500, protein: 30 });

    await request(app).delete(`/api/meals/${meal.id}`);

    const row = getDailyTotal(session.id, today());
    expect(row).toMatchObject({ calories: 0, protein: 0 });
  });

  it('deletes a meal from an earlier day and subtracts from that day', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const yesterday = addDays(today(), -1);
    insertMeal({ sessionId: session.id, date: yesterday, calories: 500, protein: 30 });
    const meal = insertMeal({
      sessionId: session.id,
      date: yesterday,
      calories: 200,
      protein: 10,
    });

    const res = await request(app).delete(`/api/meals/${meal.id}`);

    expect(res.status).toBe(204);
    expect(getMealRow(meal.id)).toBeUndefined();
    expect(getDailyTotal(session.id, yesterday)).toMatchObject({ calories: 500, protein: 30 });
  });

  it('returns 403 when deleting in a session past 90 days', async () => {
    const session = makeSession({ startDaysAgo: 90 });
    const meal = insertMeal({ sessionId: session.id, date: addDays(today(), -1) });
    const res = await request(app).delete(`/api/meals/${meal.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/90 days/);
  });

  it('returns 404 for unknown meal id', async () => {
    makeSession();
    const res = await request(app).delete('/api/meals/9999');
    expect(res.status).toBe(404);
  });
});
