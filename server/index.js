import { initDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 8002;

initDb();
const app = createApp();

app.listen(PORT, () => {
  console.log(`Calorie tracker listening on http://localhost:${PORT}`);
});
