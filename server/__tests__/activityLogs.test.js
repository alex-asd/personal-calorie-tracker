import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import {
  makeSession,
  insertActivity,
  getPresetActivity,
  insertActivityLog,
  getActivityLog,
} from './helpers/seed.js';
import { today, addDays } from '../dates.js';

let app;
let steps;
let pushups;

beforeEach(() => {
  app = createTestApp();
  steps = getPresetActivity('Steps');
  pushups = getPresetActivity('Push-ups');
});

describe('GET /api/activity-logs', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app).get('/api/activity-logs');
    expect(res.status).toBe(404);
  });

  it("returns today's logs by default", async () => {
    const session = makeSession({ startDaysAgo: 1 });
    insertActivityLog({ sessionId: session.id, activityId: steps.id, amount: 8000 });
    insertActivityLog({ sessionId: session.id, activityId: pushups.id, amount: 40 });
    insertActivityLog({
      sessionId: session.id,
      activityId: pushups.id,
      date: addDays(today(), -1),
      amount: 25,
    });

    const res = await request(app).get('/api/activity-logs');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(today());
    expect(res.body.logs).toEqual([
      { activity_id: steps.id, amount: 8000 },
      { activity_id: pushups.id, amount: 40 },
    ]);
  });

  it('returns the logs for ?date=', async () => {
    const session = makeSession({ startDaysAgo: 1 });
    const yesterday = addDays(today(), -1);
    insertActivityLog({
      sessionId: session.id,
      activityId: pushups.id,
      date: yesterday,
      amount: 25,
    });

    const res = await request(app).get(`/api/activity-logs?date=${yesterday}`);
    expect(res.body).toEqual({ date: yesterday, logs: [{ activity_id: pushups.id, amount: 25 }] });
  });

  it('only returns the open session’s logs', async () => {
    const closed = makeSession({ status: 'closed', end_date: today() });
    insertActivityLog({ sessionId: closed.id, activityId: steps.id, amount: 5000 });
    makeSession();

    const res = await request(app).get('/api/activity-logs');
    expect(res.body.logs).toEqual([]);
  });

  it('rejects a malformed date', async () => {
    makeSession();
    const res = await request(app).get('/api/activity-logs?date=yesterday');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/activity-logs', () => {
  it('returns 404 when no open session', async () => {
    const res = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: pushups.id, amount: 10 });
    expect(res.status).toBe(404);
  });

  it("creates today's total with 201", async () => {
    const session = makeSession();
    const res = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: pushups.id, amount: 20 });
    expect(res.status).toBe(201);
    expect(res.body.log).toEqual({ date: today(), activity_id: pushups.id, amount: 20 });
    expect(getActivityLog(session.id, today(), pushups.id).amount).toBe(20);
  });

  it('adds to an existing total with 200', async () => {
    const session = makeSession();
    insertActivityLog({ sessionId: session.id, activityId: pushups.id, amount: 20 });

    const res = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: pushups.id, amount: 15 });
    expect(res.status).toBe(200);
    expect(res.body.log.amount).toBe(35);
    expect(getActivityLog(session.id, today(), pushups.id).amount).toBe(35);
  });

  it('accepts decimal amounts (e.g. km for a custom activity)', async () => {
    makeSession();
    const run = insertActivity({ name: 'Running', unit: 'km' });
    const res = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: run.id, amount: '5.2' });
    expect(res.status).toBe(201);
    expect(res.body.log.amount).toBe(5.2);
  });

  it('logs to a past day of the session via body date', async () => {
    const session = makeSession({ startDaysAgo: 3 });
    const date = addDays(today(), -2);
    const res = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: steps.id, amount: 6000, date });
    expect(res.status).toBe(201);
    expect(res.body.log.date).toBe(date);
    expect(getActivityLog(session.id, date, steps.id).amount).toBe(6000);
  });

  it('rejects a date before the session start, a future date and a malformed date', async () => {
    makeSession({ startDaysAgo: 1 });
    const body = { activity_id: steps.id, amount: 100 };
    for (const date of [addDays(today(), -2), addDays(today(), 1), '2026-02-31']) {
      const res = await request(app)
        .post('/api/activity-logs')
        .send({ ...body, date });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a missing, zero, negative or non-numeric amount', async () => {
    makeSession();
    for (const amount of [undefined, 0, -5, 'abc', null]) {
      const res = await request(app)
        .post('/api/activity-logs')
        .send({ activity_id: pushups.id, amount });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/amount/);
    }
  });

  it('rejects a missing or unknown activity_id', async () => {
    makeSession();
    const missing = await request(app).post('/api/activity-logs').send({ amount: 10 });
    expect(missing.status).toBe(400);
    const unknown = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: 9999, amount: 10 });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toMatch(/activity not found/);
  });

  it('allows logging on day 90 and returns 403 on day 91', async () => {
    makeSession({ startDaysAgo: 89 });
    const ok = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: pushups.id, amount: 10 });
    expect(ok.status).toBe(201);

    app = createTestApp();
    makeSession({ startDaysAgo: 90 });
    const blocked = await request(app)
      .post('/api/activity-logs')
      .send({ activity_id: getPresetActivity('Push-ups').id, amount: 10 });
    expect(blocked.status).toBe(403);
  });
});

describe('PUT /api/activity-logs/:date/:activityId', () => {
  it('creates with 201 and replaces with 200', async () => {
    const session = makeSession();
    const created = await request(app)
      .put(`/api/activity-logs/${today()}/${steps.id}`)
      .send({ amount: 4000 });
    expect(created.status).toBe(201);
    expect(created.body.log.amount).toBe(4000);

    const replaced = await request(app)
      .put(`/api/activity-logs/${today()}/${steps.id}`)
      .send({ amount: 9500 });
    expect(replaced.status).toBe(200);
    expect(replaced.body.log.amount).toBe(9500);
    expect(getActivityLog(session.id, today(), steps.id).amount).toBe(9500);
  });

  it('sets a past day of the session', async () => {
    const session = makeSession({ startDaysAgo: 5 });
    const res = await request(app)
      .put(`/api/activity-logs/${session.start_date}/${pushups.id}`)
      .send({ amount: 30 });
    expect(res.status).toBe(201);
    expect(getActivityLog(session.id, session.start_date, pushups.id).amount).toBe(30);
  });

  it('rejects out-of-range and malformed dates', async () => {
    makeSession({ startDaysAgo: 1 });
    for (const date of [addDays(today(), -2), addDays(today(), 1), '2026-13-01']) {
      const res = await request(app)
        .put(`/api/activity-logs/${date}/${steps.id}`)
        .send({ amount: 100 });
      expect(res.status).toBe(400);
    }
  });

  it('rejects a non-positive amount', async () => {
    makeSession();
    const res = await request(app)
      .put(`/api/activity-logs/${today()}/${steps.id}`)
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown activity and 400 for a non-integer id', async () => {
    makeSession();
    const unknown = await request(app)
      .put(`/api/activity-logs/${today()}/9999`)
      .send({ amount: 10 });
    expect(unknown.status).toBe(404);
    const bad = await request(app).put(`/api/activity-logs/${today()}/abc`).send({ amount: 10 });
    expect(bad.status).toBe(400);
  });

  it('returns 404 when no open session and 403 when blocked', async () => {
    const none = await request(app)
      .put(`/api/activity-logs/${today()}/${steps.id}`)
      .send({ amount: 10 });
    expect(none.status).toBe(404);

    makeSession({ startDaysAgo: 90 });
    const blocked = await request(app)
      .put(`/api/activity-logs/${today()}/${steps.id}`)
      .send({ amount: 10 });
    expect(blocked.status).toBe(403);
  });
});

describe('DELETE /api/activity-logs/:date/:activityId', () => {
  it("clears that day's total", async () => {
    const session = makeSession();
    insertActivityLog({ sessionId: session.id, activityId: steps.id, amount: 7000 });
    insertActivityLog({ sessionId: session.id, activityId: pushups.id, amount: 30 });

    const res = await request(app).delete(`/api/activity-logs/${today()}/${steps.id}`);
    expect(res.status).toBe(204);
    expect(getActivityLog(session.id, today(), steps.id)).toBeUndefined();
    // Other activities on the same day are untouched.
    expect(getActivityLog(session.id, today(), pushups.id).amount).toBe(30);
  });

  it('returns 404 when nothing is logged', async () => {
    makeSession();
    const res = await request(app).delete(`/api/activity-logs/${today()}/${steps.id}`);
    expect(res.status).toBe(404);
  });

  it('rejects a date outside the session', async () => {
    makeSession();
    const res = await request(app).delete(`/api/activity-logs/${addDays(today(), -1)}/${steps.id}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when no open session and 403 when blocked', async () => {
    const none = await request(app).delete(`/api/activity-logs/${today()}/${steps.id}`);
    expect(none.status).toBe(404);

    const session = makeSession({ startDaysAgo: 90 });
    insertActivityLog({ sessionId: session.id, activityId: steps.id });
    const blocked = await request(app).delete(`/api/activity-logs/${today()}/${steps.id}`);
    expect(blocked.status).toBe(403);
    expect(getActivityLog(session.id, today(), steps.id)).toBeTruthy();
  });
});
