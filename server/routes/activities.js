import express from 'express';
import { getDb } from '../db.js';

const router = express.Router();
const PRESET_ERROR = 'preset activities cannot be changed';

function parseName(body) {
  const name = String(body?.name ?? '').trim();
  if (!name) return { error: 'name is required' };
  return { name };
}

// Blank / missing unit falls back to 'reps', the unit of most bodyweight moves.
function parseUnit(raw) {
  return String(raw ?? '').trim() || 'reps';
}

function serialize(row) {
  return row && { ...row, is_preset: Boolean(row.is_preset) };
}

// `log_count` = days logged across all sessions; the client shows it before a delete.
const SELECT_ACTIVITY = `
  SELECT a.id, a.name, a.unit, a.is_preset, a.created_at,
         (SELECT COUNT(*) FROM daily_activities d WHERE d.activity_id = a.id) AS log_count
  FROM activities a`;

function getActivity(db, id) {
  return serialize(db.prepare(`${SELECT_ACTIVITY} WHERE a.id = ?`).get(id));
}

// Presets first in their seeded order, then custom activities oldest-first.
router.get('/', (req, res) => {
  const db = getDb();
  const activities = db
    .prepare(`${SELECT_ACTIVITY} ORDER BY a.is_preset DESC, a.id ASC`)
    .all()
    .map(serialize);
  res.json({ activities });
});

router.post('/', (req, res) => {
  const db = getDb();
  const parsed = parseName(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const dupe = db
    .prepare(`SELECT id FROM activities WHERE name = ? COLLATE NOCASE`)
    .get(parsed.name);
  if (dupe) return res.status(409).json({ error: 'an activity with that name already exists' });

  const info = db
    .prepare(`INSERT INTO activities (name, unit, is_preset) VALUES (?, ?, 0)`)
    .run(parsed.name, parseUnit(req.body?.unit));
  res.status(201).json({ activity: getActivity(db, info.lastInsertRowid) });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'activity not found' });
  if (existing.is_preset) return res.status(403).json({ error: PRESET_ERROR });

  const parsed = parseName(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const dupe = db
    .prepare(`SELECT id FROM activities WHERE name = ? COLLATE NOCASE AND id != ?`)
    .get(parsed.name, id);
  if (dupe) return res.status(409).json({ error: 'an activity with that name already exists' });

  // Omitting `unit` keeps the current one; an explicit blank resets it to the default.
  const unit = req.body?.unit === undefined ? existing.unit : parseUnit(req.body.unit);
  db.prepare(`UPDATE activities SET name = ?, unit = ? WHERE id = ?`).run(parsed.name, unit, id);
  res.json({ activity: getActivity(db, id) });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const existing = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: 'activity not found' });
  if (existing.is_preset) return res.status(403).json({ error: PRESET_ERROR });

  // daily_activities.activity_id is ON DELETE CASCADE, so its logs go with it.
  db.prepare(`DELETE FROM activities WHERE id = ?`).run(id);
  res.status(204).end();
});

export default router;
