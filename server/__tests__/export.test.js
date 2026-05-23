import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { makeSession, insertMeal } from './helpers/seed.js';
import { getDb } from '../db.js';
import { today, addDays } from '../dates.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('GET /api/export', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app).get('/api/export');
    expect(res.status).toBe(404);
  });

  it('returns the open session with meals, daily_totals, and daily_weights', async () => {
    const session = makeSession({ calorie_target: 2200, protein_target: 160 });
    insertMeal({ sessionId: session.id, name: 'Lunch', calories: 600, protein: 40 });
    insertMeal({ sessionId: session.id, name: 'Snack', calories: 200, protein: 10 });
    getDb()
      .prepare(`INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)`)
      .run(session.id, today(), 80.5);

    const res = await request(app).get('/api/export');
    expect(res.status).toBe(200);

    const payload = JSON.parse(res.text);
    expect(payload.session.id).toBe(session.id);
    expect(payload.session.calorie_target).toBe(2200);
    expect(payload.meals).toHaveLength(2);
    expect(payload.meals.map((m) => m.name).sort()).toEqual(['Lunch', 'Snack']);
    expect(payload.daily_totals).toEqual([
      { date: today(), calories: 800, protein: 50 }
    ]);
    expect(payload.daily_weights).toEqual([{ date: today(), weight_kg: 80.5 }]);
    expect(payload.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sets a Content-Disposition attachment header', async () => {
    const session = makeSession();
    const res = await request(app).get('/api/export');
    expect(res.headers['content-disposition']).toMatch(
      new RegExp(`attachment; filename="tracker-session-${session.id}-`)
    );
  });

  it('orders meals by date ASC then created_at ASC', async () => {
    const session = makeSession({ startDaysAgo: 2 });
    insertMeal({ sessionId: session.id, date: today(), name: 'today' });
    insertMeal({
      sessionId: session.id,
      date: addDays(today(), -2),
      name: 'oldest'
    });
    insertMeal({
      sessionId: session.id,
      date: addDays(today(), -1),
      name: 'middle'
    });

    const res = await request(app).get('/api/export');
    const payload = JSON.parse(res.text);
    expect(payload.meals.map((m) => m.name)).toEqual(['oldest', 'middle', 'today']);
  });
});
