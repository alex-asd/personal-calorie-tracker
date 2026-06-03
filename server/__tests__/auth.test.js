import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { closeDb, initDb } from '../db.js';
import { createApp } from '../app.js';

const PASSWORD = 'sekret';

function basicHeader(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
}

function encodeBasic(raw) {
  return 'Basic ' + Buffer.from(raw, 'utf8').toString('base64');
}

let app;
let savedPassword;

describe('basicAuth with TRACKER_PASSWORD set', () => {
  beforeEach(() => {
    savedPassword = process.env.TRACKER_PASSWORD;
    process.env.TRACKER_PASSWORD = PASSWORD;
    closeDb();
    initDb({ dbPath: ':memory:' });
    app = createApp({ serveStatic: false, requireAuth: true });
  });

  afterEach(() => {
    if (savedPassword === undefined) {
      delete process.env.TRACKER_PASSWORD;
    } else {
      process.env.TRACKER_PASSWORD = savedPassword;
    }
  });

  it('returns 401 with a WWW-Authenticate header when no Authorization is provided', async () => {
    const res = await request(app).get('/api/sessions/current');
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(/Basic realm="calorie-tracker"/);
  });

  it('returns 401 for the wrong password', async () => {
    const res = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', basicHeader('anyuser', 'wrong'));
    expect(res.status).toBe(401);
  });

  it('passes through with the correct password (username is ignored)', async () => {
    const res = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', basicHeader('anyuser', PASSWORD));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('session');
  });

  it('returns 401 when the decoded Basic value has no colon', async () => {
    const res = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', encodeBasic('nocolonhere'));
    expect(res.status).toBe(401);
  });

  it('returns 401 for a non-Basic Authorization header', async () => {
    const res = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', 'Bearer some-token');
    expect(res.status).toBe(401);
  });

  it('returns 401 when the supplied password differs in length from expected', async () => {
    // 'sekret ' has a trailing space — same prefix, different length, exercises
    // the length guard in timingSafeEqual.
    const res = await request(app)
      .get('/api/sessions/current')
      .set('Authorization', basicHeader('anyuser', PASSWORD + ' '));
    expect(res.status).toBe(401);
  });

  it('also gates non-API routes (catch-all SPA fallback would be protected too)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(401);
  });
});

describe('basicAuth no-op when TRACKER_PASSWORD is unset', () => {
  beforeEach(() => {
    savedPassword = process.env.TRACKER_PASSWORD;
    delete process.env.TRACKER_PASSWORD;
    closeDb();
    initDb({ dbPath: ':memory:' });
    // requireAuth: true keeps the middleware mounted, but it should pass through
    // because the env var is empty.
    app = createApp({ serveStatic: false, requireAuth: true });
  });

  afterEach(() => {
    if (savedPassword === undefined) {
      delete process.env.TRACKER_PASSWORD;
    } else {
      process.env.TRACKER_PASSWORD = savedPassword;
    }
  });

  it('passes through requests with no Authorization header', async () => {
    const res = await request(app).get('/api/sessions/current');
    expect(res.status).toBe(200);
  });
});
