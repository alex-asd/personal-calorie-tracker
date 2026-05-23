import { initDb, closeDb } from '../../db.js';
import { createApp } from '../../app.js';

export function createTestApp() {
  closeDb();
  initDb({ dbPath: ':memory:' });
  return createApp({ serveStatic: false });
}
