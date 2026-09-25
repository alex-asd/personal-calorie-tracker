import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/app.js';
import {
  makeSession,
  insertActivity,
  getPresetActivity,
  insertActivityLog,
} from './helpers/seed.js';
import { getDb } from '../db.js';

let app;

beforeEach(() => {
  app = createTestApp();
});

const PRESETS = ['Steps', 'Pull-ups', 'Push-ups', 'Sit-ups', 'Squats'];

describe('GET /api/activities', () => {
  it('returns the five presets initially, in seeded order', async () => {
    const res = await request(app).get('/api/activities');
    expect(res.status).toBe(200);
    expect(res.body.activities.map((a) => a.name)).toEqual(PRESETS);
    for (const a of res.body.activities) {
      expect(a.is_preset).toBe(true);
      expect(a.log_count).toBe(0);
    }
    expect(res.body.activities[0].unit).toBe('steps');
  });

  it('lists custom activities after the presets, oldest first', async () => {
    insertActivity({ name: 'Plank', unit: 'sec' });
    insertActivity({ name: 'Burpees' });

    const res = await request(app).get('/api/activities');
    expect(res.body.activities.map((a) => a.name)).toEqual([...PRESETS, 'Plank', 'Burpees']);
    const plank = res.body.activities.find((a) => a.name === 'Plank');
    expect(plank).toMatchObject({ unit: 'sec', is_preset: false });
  });

  it('counts logged days across sessions in log_count', async () => {
    const closed = makeSession({ status: 'closed', startDaysAgo: 20 });
    const open = makeSession();
    const pushups = getPresetActivity('Push-ups');
    insertActivityLog({ sessionId: closed.id, activityId: pushups.id, date: closed.start_date });
    insertActivityLog({ sessionId: open.id, activityId: pushups.id });

    const res = await request(app).get('/api/activities');
    expect(res.body.activities.find((a) => a.name === 'Push-ups').log_count).toBe(2);
  });
});

describe('POST /api/activities', () => {
  it('creates a custom activity', async () => {
    const res = await request(app).post('/api/activities').send({ name: 'Plank', unit: 'sec' });
    expect(res.status).toBe(201);
    expect(res.body.activity).toMatchObject({
      name: 'Plank',
      unit: 'sec',
      is_preset: false,
      log_count: 0,
    });
  });

  it('trims the name and defaults a blank unit to reps', async () => {
    const res = await request(app).post('/api/activities').send({ name: '  Dips  ', unit: ' ' });
    expect(res.status).toBe(201);
    expect(res.body.activity).toMatchObject({ name: 'Dips', unit: 'reps' });
  });

  it('rejects a blank name', async () => {
    const res = await request(app).post('/api/activities').send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/);
  });

  it('rejects a duplicate of a preset name (case-insensitive)', async () => {
    const res = await request(app).post('/api/activities').send({ name: 'push-ups' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });

  it('rejects a duplicate of a custom name (case-insensitive)', async () => {
    insertActivity({ name: 'Plank' });
    const res = await request(app).post('/api/activities').send({ name: 'PLANK' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/activities/:id', () => {
  it('renames a custom activity and changes its unit', async () => {
    const a = insertActivity({ name: 'Plank', unit: 'sec' });
    const res = await request(app)
      .put(`/api/activities/${a.id}`)
      .send({ name: 'Side plank', unit: 'min' });
    expect(res.status).toBe(200);
    expect(res.body.activity).toMatchObject({ name: 'Side plank', unit: 'min' });
  });

  it('keeps the current unit when unit is omitted', async () => {
    const a = insertActivity({ name: 'Plank', unit: 'sec' });
    const res = await request(app).put(`/api/activities/${a.id}`).send({ name: 'Plank hold' });
    expect(res.status).toBe(200);
    expect(res.body.activity.unit).toBe('sec');
  });

  it('allows a case-only rename of itself', async () => {
    const a = insertActivity({ name: 'plank' });
    const res = await request(app).put(`/api/activities/${a.id}`).send({ name: 'Plank' });
    expect(res.status).toBe(200);
    expect(res.body.activity.name).toBe('Plank');
  });

  it('returns 403 for a preset', async () => {
    const steps = getPresetActivity('Steps');
    const res = await request(app).put(`/api/activities/${steps.id}`).send({ name: 'Walking' });
    expect(res.status).toBe(403);
    expect(getPresetActivity('Steps')).toBeTruthy();
  });

  it('returns 409 when renaming onto another name', async () => {
    const a = insertActivity({ name: 'Plank' });
    const res = await request(app).put(`/api/activities/${a.id}`).send({ name: 'squats' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for a blank name', async () => {
    const a = insertActivity({ name: 'Plank' });
    const res = await request(app).put(`/api/activities/${a.id}`).send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown id and 400 for a non-integer id', async () => {
    expect((await request(app).put('/api/activities/9999').send({ name: 'x' })).status).toBe(404);
    expect((await request(app).put('/api/activities/abc').send({ name: 'x' })).status).toBe(400);
  });
});

describe('DELETE /api/activities/:id', () => {
  it('deletes a custom activity and cascades its logs', async () => {
    const session = makeSession();
    const a = insertActivity({ name: 'Plank' });
    insertActivityLog({ sessionId: session.id, activityId: a.id, amount: 60 });

    const res = await request(app).delete(`/api/activities/${a.id}`);
    expect(res.status).toBe(204);

    const db = getDb();
    expect(db.prepare(`SELECT * FROM activities WHERE id = ?`).get(a.id)).toBeUndefined();
    const logs = db
      .prepare(`SELECT COUNT(*) AS n FROM daily_activities WHERE activity_id = ?`)
      .get(a.id);
    expect(logs.n).toBe(0);
  });

  it('returns 403 for a preset and keeps it', async () => {
    const squats = getPresetActivity('Squats');
    const res = await request(app).delete(`/api/activities/${squats.id}`);
    expect(res.status).toBe(403);
    expect(getPresetActivity('Squats')).toBeTruthy();
  });

  it('returns 404 for an unknown id and 400 for a non-integer id', async () => {
    expect((await request(app).delete('/api/activities/9999')).status).toBe(404);
    expect((await request(app).delete('/api/activities/abc')).status).toBe(400);
  });
});
