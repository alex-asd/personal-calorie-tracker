import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { makeSession } from './helpers/seed.js';
import { getDb } from '../db.js';
import { today, addDays } from '../dates.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('GET /api/weights', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app).get('/api/weights');
    expect(res.status).toBe(404);
  });

  it('returns session weight context and an empty list when nothing is logged', async () => {
    const session = makeSession({ start_weight_kg: 80, goal_weight_kg: 75 });
    const res = await request(app).get('/api/weights');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      session_id: session.id,
      start_date: session.start_date,
      start_weight_kg: 80,
      goal_weight_kg: 75,
      weights: [],
    });
  });

  it('returns null for start_weight_kg and goal_weight_kg when the session did not set them', async () => {
    makeSession();
    const res = await request(app).get('/api/weights');
    expect(res.status).toBe(200);
    expect(res.body.start_weight_kg).toBeNull();
    expect(res.body.goal_weight_kg).toBeNull();
    expect(res.body.weights).toEqual([]);
  });

  it('returns daily weights sorted ascending by date', async () => {
    const session = makeSession({ startDaysAgo: 5 });
    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)`
    );
    insert.run(session.id, today(), 79);
    insert.run(session.id, session.start_date, 80.5);

    const res = await request(app).get('/api/weights');
    expect(res.status).toBe(200);
    expect(res.body.weights).toEqual([
      { date: session.start_date, weight_kg: 80.5 },
      { date: today(), weight_kg: 79 },
    ]);
  });
});

describe('GET /api/weights/today', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app).get('/api/weights/today');
    expect(res.status).toBe(404);
  });

  it('returns null when nothing is logged today', async () => {
    makeSession();
    const res = await request(app).get('/api/weights/today');
    expect(res.status).toBe(200);
    expect(res.body.weight).toBeNull();
  });

  it('returns the row when logged', async () => {
    const session = makeSession();
    getDb()
      .prepare(`INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)`)
      .run(session.id, today(), 80.5);

    const res = await request(app).get('/api/weights/today');
    expect(res.body.weight).toMatchObject({ date: today(), weight_kg: 80.5 });
  });
});

describe('POST /api/weights', () => {
  it('logs a weight for today', async () => {
    makeSession();
    const res = await request(app).post('/api/weights').send({ weight_kg: 79.2 });
    expect(res.status).toBe(201);
    expect(res.body.weight).toMatchObject({ date: today(), weight_kg: 79.2 });
  });

  it('returns 409 when a weight already exists for today (replace-by-delete)', async () => {
    makeSession();
    await request(app).post('/api/weights').send({ weight_kg: 80 });
    const second = await request(app).post('/api/weights').send({ weight_kg: 79 });
    expect(second.status).toBe(409);
  });

  it('returns 404 when no open session', async () => {
    const res = await request(app).post('/api/weights').send({ weight_kg: 80 });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the session has exceeded 90 days', async () => {
    makeSession({ startDaysAgo: 90 });
    const res = await request(app).post('/api/weights').send({ weight_kg: 80 });
    expect(res.status).toBe(403);
  });

  it('rejects missing weight_kg', async () => {
    makeSession();
    const res = await request(app).post('/api/weights').send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-positive weight_kg', async () => {
    makeSession();
    const res = await request(app).post('/api/weights').send({ weight_kg: 0 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/weights/today', () => {
  it("removes today's weight", async () => {
    makeSession();
    await request(app).post('/api/weights').send({ weight_kg: 80 });

    const res = await request(app).delete('/api/weights/today');
    expect(res.status).toBe(204);

    const after = await request(app).get('/api/weights/today');
    expect(after.body.weight).toBeNull();
  });

  it('supports the replace-by-delete pattern: delete then re-log', async () => {
    makeSession();
    await request(app).post('/api/weights').send({ weight_kg: 80 });
    await request(app).delete('/api/weights/today');
    const res = await request(app).post('/api/weights').send({ weight_kg: 79 });
    expect(res.status).toBe(201);
    expect(res.body.weight.weight_kg).toBe(79);
  });

  it('returns 404 when nothing is logged', async () => {
    makeSession();
    const res = await request(app).delete('/api/weights/today');
    expect(res.status).toBe(404);
  });

  it('returns 404 when no open session', async () => {
    const res = await request(app).delete('/api/weights/today');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/weights/:date', () => {
  it('logs a weight for a past day of the open session', async () => {
    const session = makeSession({ startDaysAgo: 5 });
    const date = session.start_date;
    const res = await request(app).put(`/api/weights/${date}`).send({ weight_kg: 81.3 });
    expect(res.status).toBe(201);
    expect(res.body.weight).toEqual({ date, weight_kg: 81.3 });

    const history = await request(app).get('/api/weights');
    expect(history.body.weights).toEqual([{ date, weight_kg: 81.3 }]);
  });

  it('replaces an existing entry for that day and returns 200', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const date = session.start_date;
    await request(app).put(`/api/weights/${date}`).send({ weight_kg: 80 });
    const res = await request(app).put(`/api/weights/${date}`).send({ weight_kg: 79.4 });
    expect(res.status).toBe(200);
    expect(res.body.weight).toEqual({ date, weight_kg: 79.4 });

    const history = await request(app).get('/api/weights');
    expect(history.body.weights).toEqual([{ date, weight_kg: 79.4 }]);
  });

  it('works for today and is visible through GET /today', async () => {
    makeSession();
    const res = await request(app).put(`/api/weights/${today()}`).send({ weight_kg: 78 });
    expect(res.status).toBe(201);
    const t = await request(app).get('/api/weights/today');
    expect(t.body.weight).toEqual({ date: today(), weight_kg: 78 });
  });

  it('rejects a date before the session start', async () => {
    const session = makeSession({ startDaysAgo: 2 });
    const before = addDays(session.start_date, -1);
    const res = await request(app).put(`/api/weights/${before}`).send({ weight_kg: 80 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before the session start/);
  });

  it('rejects a future date', async () => {
    makeSession();
    const res = await request(app)
      .put(`/api/weights/${addDays(today(), 1)}`)
      .send({ weight_kg: 80 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/);
  });

  it('rejects a malformed or impossible date', async () => {
    makeSession();
    for (const bad of ['today', '2026-1-5', '2026-13-40']) {
      const res = await request(app).put(`/api/weights/${bad}`).send({ weight_kg: 80 });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a non-positive weight', async () => {
    makeSession();
    const res = await request(app).put(`/api/weights/${today()}`).send({ weight_kg: -1 });
    expect(res.status).toBe(400);
  });

  it('returns 403 when the session has exceeded 90 days', async () => {
    const session = makeSession({ startDaysAgo: 90 });
    const res = await request(app)
      .put(`/api/weights/${session.start_date}`)
      .send({ weight_kg: 80 });
    expect(res.status).toBe(403);
  });

  it('returns 404 when no open session', async () => {
    const res = await request(app).put(`/api/weights/${today()}`).send({ weight_kg: 80 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/weights/:date', () => {
  it('removes the weight for a past day', async () => {
    const session = makeSession({ startDaysAgo: 4 });
    const date = session.start_date;
    await request(app).put(`/api/weights/${date}`).send({ weight_kg: 80 });

    const res = await request(app).delete(`/api/weights/${date}`);
    expect(res.status).toBe(204);

    const history = await request(app).get('/api/weights');
    expect(history.body.weights).toEqual([]);
  });

  it('returns 404 when nothing is logged for that day', async () => {
    const session = makeSession({ startDaysAgo: 4 });
    const res = await request(app).delete(`/api/weights/${session.start_date}`);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed date', async () => {
    makeSession();
    const res = await request(app).delete('/api/weights/not-a-date');
    expect(res.status).toBe(400);
  });

  it('still honours the literal /today route', async () => {
    makeSession();
    await request(app).put(`/api/weights/${today()}`).send({ weight_kg: 80 });
    const res = await request(app).delete('/api/weights/today');
    expect(res.status).toBe(204);
  });
});
