import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb } from './db.js';
import sessionsRouter from './routes/sessions.js';
import mealsRouter from './routes/meals.js';
import savedMealsRouter from './routes/savedMeals.js';
import exportRouter from './routes/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

initDb();

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/sessions', sessionsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/saved-meals', savedMealsRouter);
app.use('/api/export', exportRouter);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      'Client build not found. In development, run `npm run dev:client` and open the Vite URL. For production, run `npm run build` first.'
    );
  });
}

app.listen(PORT, () => {
  console.log(`Calorie tracker listening on http://localhost:${PORT}`);
});
