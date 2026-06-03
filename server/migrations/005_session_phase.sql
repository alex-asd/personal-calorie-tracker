ALTER TABLE sessions ADD COLUMN phase TEXT NOT NULL DEFAULT 'cut' CHECK(phase IN ('cut', 'bulk'));
