-- 013_pending_transactions.sql
-- "Pending" flags a transaction as a placeholder the retreat manager entered
-- as a reminder -- an expected client payment or hotel commission that
-- hasn't actually landed yet. It still counts toward retreat_actuals (the
-- manager wants the P&L to reflect the expected number), but a retreat
-- can't be locked/audited while any of its coded transactions are still
-- pending, so the placeholder can't quietly get forgotten and signed off on
-- as if the cash had actually arrived.

alter table transactions add column pending boolean not null default false;

comment on column transactions.pending is
  'Placeholder for money expected but not yet received/paid (e.g. an anticipated client payment or hotel commission). Still counts in retreat_actuals; blocks locking the retreat it is coded to.';

create function enforce_no_pending_transactions_on_lock()
returns trigger
language plpgsql
as $$
declare
  pending_count integer;
begin
  select count(*) into pending_count
  from transaction_codings tc
  join transactions t on t.id = tc.transaction_id
  where tc.retreat_id = new.retreat_id
    and t.pending = true
    and t.is_deleted_by_source = false;

  if pending_count > 0 then
    raise exception 'Cannot lock retreat: % pending transaction(s) still coded to it', pending_count;
  end if;

  return new;
end;
$$;

create trigger retreat_locks_enforce_no_pending
  before insert on retreat_locks
  for each row execute function enforce_no_pending_transactions_on_lock();
