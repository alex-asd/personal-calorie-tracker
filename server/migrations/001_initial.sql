CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT,
  calorie_target INTEGER NOT NULL,
  protein_target INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','closed')) DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_meals (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL,
  fat REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE meals (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  calories REAL NOT NULL,
  protein REAL NOT NULL,
  carbs REAL,
  fat REAL,
  source_saved_meal_id INTEGER REFERENCES saved_meals(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_meals_session_date ON meals(session_id, date);

CREATE TABLE daily_totals (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, date)
);

CREATE TABLE daily_weights (
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, date)
);

CREATE UNIQUE INDEX idx_one_open_session
  ON sessions(status) WHERE status = 'open';
