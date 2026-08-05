-- 018_transactions_is_coded_flag.sql
-- The Uncoded/Coded transactions filter used to resolve matching transaction
-- ids with a separate query, then pass that id list through .in()/
-- .not("id","in",...) before paginating. Once there are enough coded
-- transactions, that id list blows past the URL length Supabase-js's GET
-- request can carry, and the whole /api/transactions request 400s --
-- silently rendered by the client as "no transactions match these filters."
--
-- Trigger-maintained boolean instead, mirroring 011_ongoing_audited_status's
-- retreat_status pattern exactly: a plain indexed column on the table being
-- queried, kept correct regardless of which code path inserts/deletes a
-- coding, filterable directly with .eq() before .range() with no size ceiling.

alter table transactions add column is_coded boolean not null default false;

update transactions t
set is_coded = exists (
  select 1 from transaction_codings tc where tc.transaction_id = t.id
);

create index transactions_is_coded_idx on transactions (is_coded);

comment on column transactions.is_coded is
  'Trigger-derived from transaction_codings -- never set directly. True iff at least one coding row exists for this transaction.';

create function sync_transaction_is_coded()
returns trigger
language plpgsql
as $$
begin
  -- Defensive about which side(s) changed, matching
  -- enforce_coding_sum_matches_transaction's own coalesce(new, old) pattern
  -- in 014 -- no code path currently updates transaction_codings.transaction_id
  -- on an existing row (writes are always insert or delete), but this stays
  -- correct even if that ever changes.
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.transaction_id is distinct from old.transaction_id) then
    update transactions
    set is_coded = exists (select 1 from transaction_codings where transaction_id = old.transaction_id)
    where id = old.transaction_id;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    update transactions
    set is_coded = exists (select 1 from transaction_codings where transaction_id = new.transaction_id)
    where id = new.transaction_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger transaction_codings_sync_is_coded
  after insert or update or delete on transaction_codings
  for each row execute function sync_transaction_is_coded();
