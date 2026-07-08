-- 009_transaction_reconciliation.sql
-- Supports the /reconcile workflow: matching transactions against an
-- uploaded bank/card statement CSV as a sanity check on top of Plaid sync
-- (catches sync gaps, duplicates, or discrepancies).

alter table transactions add column reconciled boolean not null default false;
alter table transactions add column reconciled_at timestamptz;
alter table transactions add column reconciled_by uuid references profiles(id);

create index transactions_reconciled_idx on transactions(reconciled);
