-- Deliberately separate from the planned multi-user MVP schema.
CREATE TABLE poc_sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE poc_parses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES poc_sessions(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  day TEXT NOT NULL,
  input TEXT NOT NULL,
  result TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, request_id)
);
CREATE INDEX poc_parses_day_session ON poc_parses(day, session_id);
CREATE TABLE poc_transactions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES poc_sessions(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  source_parse_id TEXT UNIQUE REFERENCES poc_parses(id),
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0 AND amount_minor <= 100000000),
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('transport','dining','groceries','bills','shopping','salary','other-income','other-expense')),
  description TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, request_id),
  CHECK((type = 'income' AND category IN ('salary','other-income')) OR (type = 'expense' AND category NOT IN ('salary','other-income')))
);
CREATE INDEX poc_transactions_session_date ON poc_transactions(session_id, date, created_at);
