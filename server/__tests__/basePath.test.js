import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { closeDb, initDb } from '../db.js';
import { createApp } from '../app.js';
import { normalizeBasePath, applyBasePathToHtml } from '../basePath.js';

describe('normalizeBasePath', () => {
  it('treats empty / root values as the site root ("")', () => {
    expect(normalizeBasePath(undefined)).toBe('');
    expect(normalizeBasePath('')).toBe('');
    expect(normalizeBasePath('/')).toBe('');
    expect(normalizeBasePath('   ')).toBe('');
  });

  it('normalizes a sub-path to a leading slash with no trailing slash', () => {
    expect(normalizeBasePath('/calorie')).toBe('/calorie');
    expect(normalizeBasePath('calorie')).toBe('/calorie');
    expect(normalizeBasePath('calorie/')).toBe('/calorie');
    expect(normalizeBasePath('/calorie/')).toBe('/calorie');
    expect(normalizeBasePath('//calorie//')).toBe('/calorie');
  });

  it('preserves inner segments', () => {
    expect(normalizeBasePath('/app/calorie/')).toBe('/app/calorie');
  });
});

describe('applyBasePathToHtml', () => {
  const html =
    '<!doctype html><html><head>' +
    '<link rel="icon" href="/favicon.ico" />' +
    '<link rel="manifest" href="/site.webmanifest" />' +
    '<script type="module" crossorigin src="/assets/index-abc.js"></script>' +
    '<link rel="stylesheet" href="/assets/index-abc.css">' +
    '</head><body><div id="root"></div></body></html>';

  it('at the root: leaves asset URLs untouched, injects __APP_BASE__ = "/"', () => {
    const out = applyBasePathToHtml(html, '');
    expect(out).toContain('src="/assets/index-abc.js"');
    expect(out).toContain('href="/favicon.ico"');
    expect(out).toContain('<script>window.__APP_BASE__="/"</script></head>');
  });

  it('under a sub-path: prefixes asset URLs and injects the mount point', () => {
    const out = applyBasePathToHtml(html, '/calorie');
    expect(out).toContain('src="/calorie/assets/index-abc.js"');
    expect(out).toContain('href="/calorie/assets/index-abc.css"');
    expect(out).toContain('href="/calorie/favicon.ico"');
    expect(out).toContain('href="/calorie/site.webmanifest"');
    expect(out).toContain('<script>window.__APP_BASE__="/calorie/"</script></head>');
    // The injected value itself must not be double-prefixed.
    expect(out).not.toContain('__APP_BASE__="/calorie/calorie/"');
  });

  it('leaves protocol-relative URLs (//…) alone', () => {
    const out = applyBasePathToHtml(
      '<head><script src="//cdn.example/x.js"></script></head>',
      '/calorie'
    );
    expect(out).toContain('src="//cdn.example/x.js"');
  });
});

describe('API routing under BASE_PATH', () => {
  let app;

  beforeEach(() => {
    closeDb();
    initDb({ dbPath: ':memory:' });
    app = createApp({ serveStatic: false, requireAuth: false, basePath: '/calorie' });
  });

  it('serves the API under the base path', async () => {
    const health = await request(app).get('/calorie/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const current = await request(app).get('/calorie/api/sessions/current');
    expect(current.status).toBe(200);
    expect(current.body).toHaveProperty('session');
  });

  it('does not expose the API at the root when a base path is set', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(404);
  });
});
