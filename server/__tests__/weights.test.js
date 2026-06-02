import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { makeSession } from './helpers/seed.js';
import { getDb } from '../db.js';
import { today } from '../dates.js';

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
