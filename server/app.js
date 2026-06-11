import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basicAuth } from './auth.js';
import { normalizeBasePath, applyBasePathToHtml } from './basePath.js';
import sessionsRouter from './routes/sessions.js';
import mealsRouter from './routes/meals.js';
import savedMealsRouter from './routes/savedMeals.js';
import categoriesRouter from './routes/categories.js';
import weightsRouter from './routes/weights.js';
import exportRouter from './routes/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the built index.html and adapt it to the mount point (asset-URL
// prefixing + `window.__APP_BASE__` injection — see applyBasePathToHtml).
function renderIndexHtml(clientDist, base) {
  const html = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
  return applyBasePathToHtml(html, base);
}

export function createApp({
  serveStatic = true,
  requireAuth = Boolean(process.env.TRACKER_PASSWORD),
  basePath = process.env.BASE_PATH,
} = {}) {
  const base = normalizeBasePath(basePath); // '' (root) or '/calorie'
  const app = express();
  app.use(express.json());

  if (requireAuth) app.use(basicAuth);

  app.get(`${base}/api/health`, (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use(`${base}/api/sessions`, sessionsRouter);
  app.use(`${base}/api/meals`, mealsRouter);
  app.use(`${base}/api/saved-meals`, savedMealsRouter);
  app.use(`${base}/api/categories`, categoriesRouter);
  app.use(`${base}/api/weights`, weightsRouter);
  app.use(`${base}/api/export`, exportRouter);

  if (serveStatic) {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    if (fs.existsSync(clientDist)) {
      // Hashed assets, favicons and the manifest live under the base path.
      // `index: false` so the mount root falls through to the catch-all,
      // which serves the base-adapted index.html instead of the raw file.
      app.use(base || '/', express.static(clientDist, { index: false }));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith(`${base}/api/`)) return next();
        // Requests outside the mount (e.g. hitting the bare port while a
        // BASE_PATH is set) get redirected to the app root.
        if (base && req.path !== base && !req.path.startsWith(`${base}/`)) {
          return res.redirect(`${base}/`);
        }
        res.type('html').send(renderIndexHtml(clientDist, base));
      });
    } else {
      app.get('/', (req, res) => {
        res
          .type('text/plain')
          .send(
            'Client build not found. In development, run `npm run dev:client` and open the Vite URL. For production, run `npm run build` first.'
          );
      });
    }
  }

  return app;
}
