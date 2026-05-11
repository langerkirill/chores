CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  person TEXT NOT NULL CHECK (person IN ('Asuka', 'Kirill')),
  chore TEXT NOT NULL,
  chore_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS chores_chore_date_idx ON chores (chore_date);
CREATE INDEX IF NOT EXISTS chores_person_chore_date_idx ON chores (person, chore_date);
