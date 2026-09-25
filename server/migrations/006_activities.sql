CREATE TABLE activities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  unit TEXT NOT NULL DEFAULT 'reps',
  is_preset INTEGER NOT NULL DEFAULT 0 CHECK(is_preset IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO activities (name, unit, is_preset) VALUES
  ('Steps', 'steps', 1),
  ('Pull-ups', 'reps', 1),
  ('Push-ups', 'reps', 1),
  ('Sit-ups', 'reps', 1),
  ('Squats', 'reps', 1);

CREATE TABLE daily_activities (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK(amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, date, activity_id)
);

CREATE INDEX idx_daily_activities_activity ON daily_activities(activity_id);
