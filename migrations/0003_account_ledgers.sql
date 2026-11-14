-- Account-owned records are independent of auth sessions and never expire
-- merely because a session expires. Anonymous POC data remains untouched.
CREATE TABLE ledger_parses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  day TEXT NOT NULL,
  input TEXT NOT NULL,
  result TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_id),
  UNIQUE(id, user_id)
);
CREATE INDEX ledger_parses_day_user ON ledger_parses(day, user_id);
CREATE TABLE ledger_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  source_parse_id TEXT UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  amount_minor INTEGER NOT NULL CHECK(amount_minor > 0 AND amount_minor <= 100000000),
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('transport','dining','groceries','bills','shopping','salary','other-income','other-expense')),
  description TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_id),
  FOREIGN KEY(source_parse_id, user_id) REFERENCES ledger_parses(id, user_id),
  CHECK((type = 'income' AND category IN ('salary','other-income')) OR (type = 'expense' AND category NOT IN ('salary','other-income')))
);
CREATE INDEX ledger_transactions_user_date ON ledger_transactions(user_id, date, created_at);
