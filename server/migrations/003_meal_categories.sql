CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE saved_meals
  ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
