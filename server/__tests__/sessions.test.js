import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import { makeSession, insertMeal, getDailyTotal } from './helpers/seed.js';
import { getDb } from '../db.js';
import { today, addDays } from '../dates.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

describe('POST /api/sessions', () => {
  it('creates an open session with decorated dayNumber', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150 });

    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({
      status: 'open',
      calorie_target: 2000,
      protein_target: 150,
      start_date: today(),
      dayNumber: 1,
      warning: false,
      blocked: false,
    });
  });

  it('accepts optional start_weight_kg', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150, start_weight_kg: 80.5 });
    expect(res.status).toBe(201);
    expect(res.body.session.start_weight_kg).toBe(80.5);
  });

  it('rounds calorie_target and protein_target to integers', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000.7, protein_target: 150.4 });
    expect(res.status).toBe(201);
    expect(res.body.session.calorie_target).toBe(2001);
    expect(res.body.session.protein_target).toBe(150);
  });

  it('rejects missing calorie_target', async () => {
    const res = await request(app).post('/api/sessions').send({ protein_target: 150 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calorie_target/);
  });

  it('rejects zero calorie_target', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 0, protein_target: 150 });
    expect(res.status).toBe(400);
  });

  it('rejects negative start_weight_kg', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150, start_weight_kg: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/start_weight_kg/);
  });

  it('accepts optional goal_weight_kg', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150, goal_weight_kg: 72.5 });
    expect(res.status).toBe(201);
    expect(res.body.session.goal_weight_kg).toBe(72.5);
  });

  it('rejects negative goal_weight_kg', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150, goal_weight_kg: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/goal_weight_kg/);
  });

  it("defaults phase to 'cut' when omitted", async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150 });
    expect(res.status).toBe(201);
    expect(res.body.session.phase).toBe('cut');
  });

  it("accepts phase='bulk'", async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 3200, protein_target: 180, phase: 'bulk' });
    expect(res.status).toBe(201);
    expect(res.body.session.phase).toBe('bulk');
  });

  it('rejects an unknown phase value', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150, phase: 'maintenance' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/phase/);
  });

  it('returns 409 when an open session already exists', async () => {
    makeSession();
    const res = await request(app)
      .post('/api/sessions')
      .send({ calorie_target: 2000, protein_target: 150 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

describe('GET /api/sessions/current', () => {
  it('returns null when there is no open session', async () => {
    const res = await request(app).get('/api/sessions/current');
    expect(res.status).toBe(200);
    expect(res.body.session).toBeNull();
  });

  it('returns dayNumber=1 on the first day', async () => {
    makeSession({ startDaysAgo: 0 });
    const res = await request(app).get('/api/sessions/current');
    expect(res.body.session.dayNumber).toBe(1);
    expect(res.body.session.warning).toBe(false);
    expect(res.body.session.blocked).toBe(false);
  });

  it('sets warning=true on day 90', async () => {
    makeSession({ startDaysAgo: 89 });
    const res = await request(app).get('/api/sessions/current');
    expect(res.body.session.dayNumber).toBe(90);
    expect(res.body.session.warning).toBe(true);
    expect(res.body.session.blocked).toBe(false);
  });

  it('sets blocked=true on day 91', async () => {
    makeSession({ startDaysAgo: 90 });
    const res = await request(app).get('/api/sessions/current');
    expect(res.body.session.dayNumber).toBe(91);
    expect(res.body.session.warning).toBe(false);
    expect(res.body.session.blocked).toBe(true);
  });
});

describe('POST /api/sessions/:id/close', () => {
  it('sets status=closed and end_date=today', async () => {
    const session = makeSession();
    const res = await request(app).post(`/api/sessions/${session.id}/close`).send({});
    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('closed');
    expect(res.body.session.end_date).toBe(today());
  });

  it('accepts optional end_weight_kg', async () => {
    const session = makeSession();
    const res = await request(app)
      .post(`/api/sessions/${session.id}/close`)
      .send({ end_weight_kg: 78.2 });
    expect(res.status).toBe(200);
    expect(res.body.session.end_weight_kg).toBe(78.2);
  });

  it('deletes meals and daily_weights but preserves daily_totals', async () => {
    const session = makeSession();
    insertMeal({ sessionId: session.id, calories: 500, protein: 30 });
    const db = getDb();
    db.prepare(`INSERT INTO daily_weights (session_id, date, weight_kg) VALUES (?, ?, ?)`).run(
      session.id,
      today(),
      80
    );

    await request(app).post(`/api/sessions/${session.id}/close`).send({});

    const meals = db
      .prepare(`SELECT COUNT(*) AS n FROM meals WHERE session_id = ?`)
      .get(session.id);
    const weights = db
      .prepare(`SELECT COUNT(*) AS n FROM daily_weights WHERE session_id = ?`)
      .get(session.id);
    const totals = db
      .prepare(`SELECT COUNT(*) AS n FROM daily_totals WHERE session_id = ?`)
      .get(session.id);

    expect(meals.n).toBe(0);
    expect(weights.n).toBe(0);
    expect(totals.n).toBe(1);
    expect(getDailyTotal(session.id, today())).toMatchObject({ calories: 500, protein: 30 });
  });

  it('returns 404 for unknown session id', async () => {
    const res = await request(app).post('/api/sessions/9999/close').send({});
    expect(res.status).toBe(404);
  });

  it('returns 409 when closing an already-closed session', async () => {
    const session = makeSession({ status: 'closed', end_date: today() });
    const res = await request(app).post(`/api/sessions/${session.id}/close`).send({});
    expect(res.status).toBe(409);
  });

  it('rejects invalid end_weight_kg', async () => {
    const session = makeSession();
    const res = await request(app)
      .post(`/api/sessions/${session.id}/close`)
      .send({ end_weight_kg: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/sessions', () => {
  it('lists closed sessions only, with day_count', async () => {
    makeSession({ startDaysAgo: 0 });
    const closed = makeSession({
      status: 'closed',
      end_date: today(),
      startDaysAgo: 9,
    });
    closed.start_date = addDays(today(), -9);
    closed.end_date = today();

    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0]).toMatchObject({
      status: 'closed',
      day_count: 10,
    });
  });
});

describe('GET /api/sessions/:id/days', () => {
  it('returns one entry per day from end_date back to start_date, descending', async () => {
    const session = makeSession({
      status: 'closed',
      end_date: today(),
      startDaysAgo: 2,
    });
    insertMeal({ sessionId: session.id, date: today(), calories: 100, protein: 10 });
    insertMeal({
      sessionId: session.id,
      date: addDays(today(), -2),
      calories: 200,
      protein: 20,
    });

    const res = await request(app).get(`/api/sessions/${session.id}/days`);
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(3);
    expect(res.body.days.map((d) => d.date)).toEqual([
      today(),
      addDays(today(), -1),
      addDays(today(), -2),
    ]);
    expect(res.body.days[1]).toMatchObject({ calories: 0, protein: 0 });
  });

  it('returns 404 for unknown session id', async () => {
    const res = await request(app).get('/api/sessions/9999/days');
    expect(res.status).toBe(404);
  });
});
