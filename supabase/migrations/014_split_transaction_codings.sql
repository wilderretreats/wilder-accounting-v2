-- 014_split_transaction_codings.sql
-- transaction_codings moves from strictly 1:1 with transactions (its PK WAS
-- transaction_id) to 1:many, so one transaction can be split across
-- multiple category/retreat allocations -- e.g. a single wire payment that
-- actually covers two different retreats. Each coding row now carries its
-- own `amount`; all coding rows for a given transaction_id must sum exactly
-- to that transaction's amount (0 rows = fully uncoded is still valid).

alter table transaction_codings drop constraint transaction_codings_pkey;

alter table transaction_codings add column id uuid not null default gen_random_uuid();
alter table transaction_codings add primary key (id);

alter table transaction_codings add column amount numeric(12,2);
update transaction_codings tc
set amount = t.amount
from transactions t
where t.id = tc.transaction_id;
alter table transaction_codings alter column amount set not null;

comment on column transaction_codings.amount is
  'This split''s share of the parent transaction, same sign convention as '
  'transactions.amount. All coding rows for a given transaction_id must sum '
  'exactly to that transaction''s amount -- enforced by the deferred '
  'transaction_codings_enforce_sum constraint trigger below and pre-checked '
  'in the application layer before writing.';

-- transaction_id is no longer PK-backed, so it needs its own index for the
-- FK lookups (retreat detail page, "is this transaction coded" checks, etc).
create index transaction_codings_transaction_idx on transaction_codings(transaction_id);

-- Deferred so it validates the final post-statement state once per affected
-- transaction_id, regardless of insert/delete order within the statement
-- (the RPCs below always delete-then-insert in one call).
create function enforce_coding_sum_matches_transaction()
returns trigger
language plpgsql
as $$
declare
  txn_id uuid := coalesce(new.transaction_id, old.transaction_id);
  txn_amount numeric(12,2);
  row_count integer;
  coding_sum numeric(12,2);
begin
  select amount into txn_amount from transactions where id = txn_id;
  if txn_amount is null then
    return null; -- parent transaction is gone (cascade delete) -- nothing to enforce
  end if;

  select count(*), coalesce(sum(amount), 0) into row_count, coding_sum
  from transaction_codings where transaction_id = txn_id;

  if row_count = 0 then
    return null; -- fully uncoded is a valid state
  end if;

  if coding_sum <> txn_amount then
    raise exception
      'Codings for transaction % sum to % but the transaction amount is %',
      txn_id, coding_sum, txn_amount;
  end if;

  return null; -- ignored for AFTER triggers
end;
$$;

create constraint trigger transaction_codings_enforce_sum
  after insert or update or delete on transaction_codings
  deferrable initially deferred
  for each row execute function enforce_coding_sum_matches_transaction();

-- overhead_monthly_actuals: simple column swap -- INNER JOINs + WHERE mean
-- filtering is unaffected by which column is summed.
create or replace view overhead_monthly_actuals as
select
  date_trunc('month', t.posted_date)::date as month,
  c.id as category_id,
  c.parent_id as category_parent_id,
  coalesce(sum(-tc.amount), 0) as amount
from transactions t
join transaction_codings tc on tc.transaction_id = t.id
join categories c on c.id = tc.category_id
where c.type = 'overhead' and t.is_deleted_by_source = false
group by date_trunc('month', t.posted_date), c.id, c.parent_id;

-- retreat_actuals: NOT a naive t.amount -> tc.amount swap. The original
-- relied on is_deleted_by_source = false living in the LEFT JOIN ... ON
-- clause so a soft-deleted transaction's t.amount comes back NULL and SUM()
-- silently skips it. tc.amount is NOT NULL and unaffected by whether the
-- transactions join matched, so summing it directly would keep counting a
-- soft-deleted transaction's split -- moving the exclusion into each
-- FILTER (WHERE ...) clause instead preserves the original behavior.
create or replace view retreat_actuals as
select
  r.id as retreat_id,
  r.client_id,
  r.retreat_month,
  coalesce(sum(tc.amount) filter (
    where c.type = 'revenue' and t.is_deleted_by_source = false), 0) as revenue,
  coalesce(sum(-tc.amount) filter (
    where c.type = 'cogs' and t.is_deleted_by_source = false), 0) as cogs,
  coalesce(sum(-tc.amount) filter (
    where c.type = 'cogs' and c.is_flight_cost and t.is_deleted_by_source = false), 0) as flight_cogs
from retreats r
left join transaction_codings tc on tc.retreat_id = r.id
left join transactions t on t.id = tc.transaction_id
left join categories c on c.id = tc.category_id
group by r.id, r.client_id, r.retreat_month;

-- Atomically replaces one transaction's codings with a new split set.
-- security invoker (Postgres default, stated explicitly) so the existing
-- transaction_codings_write RLS policy (admin/ops) still gates this exactly
-- as if the caller ran the delete+insert directly.
create function replace_transaction_codings(
  p_transaction_id uuid,
  p_splits jsonb, -- [{ category_id, retreat_id, amount, comment }, ...]
  p_actor_id uuid
)
returns setof transaction_codings
language plpgsql
security invoker
as $$
declare
  v_txn_amount numeric(12,2);
  v_sum numeric(12,2);
  v_coded_by uuid;
  v_coded_at timestamptz;
  v_now timestamptz := now();
begin
  if jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split row is required';
  end if;

  select amount into v_txn_amount from transactions where id = p_transaction_id;
  if v_txn_amount is null then
    raise exception 'Transaction % not found', p_transaction_id;
  end if;

  select coalesce(sum((elem->>'amount')::numeric(12,2)), 0) into v_sum
  from jsonb_array_elements(p_splits) elem;
  if v_sum <> v_txn_amount then
    raise exception 'Split amounts sum to % but the transaction amount is %', v_sum, v_txn_amount;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_splits) elem
    where (elem->>'amount')::numeric(12,2) = 0
  ) then
    raise exception 'Split amounts must be non-zero';
  end if;

  select coded_by, coded_at into v_coded_by, v_coded_at
  from transaction_codings
  where transaction_id = p_transaction_id
  order by coded_at asc limit 1;
  if v_coded_by is null then
    v_coded_by := p_actor_id;
    v_coded_at := v_now;
  end if;

  delete from transaction_codings where transaction_id = p_transaction_id;

  return query
  insert into transaction_codings (
    id, transaction_id, category_id, retreat_id, amount, comment,
    coded_by, coded_at, updated_by, updated_at
  )
  select
    gen_random_uuid(), p_transaction_id,
    (elem->>'category_id')::uuid,
    nullif(elem->>'retreat_id', '')::uuid,
    (elem->>'amount')::numeric(12,2),
    elem->>'comment',
    v_coded_by, v_coded_at, p_actor_id, v_now
  from jsonb_array_elements(p_splits) elem
  returning *;
end;
$$;

grant execute on function replace_transaction_codings(uuid, jsonb, uuid) to authenticated;

-- Used by bulk-code, which always applies one category/retreat at 100% of
-- each transaction's own amount to N transactions. Written as one
-- CTE-based statement (not a temp table -- Supabase RPC calls typically run
-- through a pooled connection where session-scoped temp tables are
-- unreliable across calls).
create function replace_transaction_codings_bulk(
  p_transaction_ids uuid[],
  p_category_id uuid,
  p_retreat_id uuid,
  p_comment text,
  p_actor_id uuid
)
returns setof transaction_codings
language plpgsql
security invoker
as $$
declare
  v_now timestamptz := now();
begin
  return query
  with prior as (
    select distinct on (transaction_id) transaction_id, coded_by, coded_at
    from transaction_codings
    where transaction_id = any(p_transaction_ids)
    order by transaction_id, coded_at asc
  ),
  del as (
    delete from transaction_codings
    where transaction_id = any(p_transaction_ids)
    returning 1
  )
  insert into transaction_codings (
    id, transaction_id, category_id, retreat_id, amount, comment,
    coded_by, coded_at, updated_by, updated_at
  )
  select
    gen_random_uuid(), t.id, p_category_id, p_retreat_id, t.amount, p_comment,
    coalesce(pc.coded_by, p_actor_id), coalesce(pc.coded_at, v_now), p_actor_id, v_now
  from transactions t
  left join prior pc on pc.transaction_id = t.id
  where t.id = any(p_transaction_ids)
  returning *;
end;
$$;

grant execute on function replace_transaction_codings_bulk(uuid[], uuid, uuid, text, uuid) to authenticated;
