-- 016_overhead_transactions_scope.sql
-- Overhead transactions get their own upload/list workspace (Transactions ->
-- Overhead Transactions), kept structurally separate from the shared
-- revenue/COGS transactions list rather than just filterable within it. Set
-- at import/manual-entry time, independent of transaction_codings.category
-- -- a transaction can be flagged is_overhead before it's even coded.

alter table transactions add column is_overhead boolean not null default false;

comment on column transactions.is_overhead is
  'Routes this transaction into the overhead-only transactions workspace instead of the shared (revenue/COGS) one. Set at import/entry time, independent of how it ends up coded.';
