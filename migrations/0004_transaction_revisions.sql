-- Keep deleted rows as idempotency/provenance markers so late confirmations
-- cannot recreate a transaction that the account owner deleted.
ALTER TABLE ledger_transactions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ledger_transactions ADD COLUMN deleted_at INTEGER;
ALTER TABLE ledger_transactions ADD COLUMN last_operation_id TEXT;
