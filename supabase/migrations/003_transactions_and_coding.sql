-- 003_transactions_and_coding.sql
-- transactions = raw ledger fact (from Plaid/CSV/manual), never hand-edited
-- except description. transaction_codings = the human/rule judgment layered
-- on top, kept in a separate table so a Plaid re-sync can never clobber a
-- coding, and "uncoded" is a clean join instead of a null-check.

create table transactions (
  id                     uuid primary key default gen_random_uuid(),
  source                 text not null check (source in ('plaid', 'csv', 'manual')),
  plaid_transaction_id   text unique,
  plaid_account_id       uuid references plaid_accounts(id) on delete set null,
  account_label          text,
  posted_date            date not null,
  description            text not null,
  amount                 numeric(12,2) not null,
  raw_plaid_payload      jsonb,
  import_batch_id        uuid references import_batches(id) on delete set null,
  migration_row_hash     text unique,
  is_deleted_by_source   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on column transactions.amount is
  'Negative = money out, positive = money in. Plaid''s sign convention (positive = outflow) is inverted at ingest time to match this.';
comment on column transactions.is_deleted_by_source is
  'Plaid "removed" events soft-delete here rather than hard DELETE, preserving coding/audit history.';

create index transactions_posted_date_idx on transactions(posted_date desc);
create index transactions_source_idx on transactions(source);
create index transactions_plaid_account_idx on transactions(plaid_account_id);
create index transactions_deleted_idx on transactions(is_deleted_by_source) where is_deleted_by_source = false;

create trigger transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- transaction_codings — 1:1 with transactions.
-- ---------------------------------------------------------------------------
create table transaction_codings (
  transaction_id  uuid primary key references transactions(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete restrict,
  retreat_id      uuid references retreats(id) on delete restrict,
  comment         text,
  coded_by        uuid not null references profiles(id),
  coded_at        timestamptz not null default now(),
  updated_by      uuid references profiles(id),
  updated_at      timestamptz not null default now()
);

create index transaction_codings_retreat_idx on transaction_codings(retreat_id);
create index transaction_codings_category_idx on transaction_codings(category_id);

-- Enforce: category.type = 'overhead' => retreat_id is null;
--          category.type in ('revenue','cogs') => retreat_id is not null.
create function enforce_coding_retreat_consistency()
returns trigger
language plpgsql
as $$
declare
  cat_type category_type;
begin
  select type into cat_type from categories where id = new.category_id;
  if cat_type is null then
    raise exception 'Category % does not exist', new.category_id;
  end if;

  if cat_type = 'overhead' and new.retreat_id is not null then
    raise exception 'Overhead transactions cannot be coded to a retreat';
  end if;

  if cat_type in ('revenue', 'cogs') and new.retreat_id is null then
    raise exception 'Revenue/COGS transactions must be coded to a retreat';
  end if;

  return new;
end;
$$;

create trigger transaction_codings_enforce_retreat_consistency
  before insert or update on transaction_codings
  for each row execute function enforce_coding_retreat_consistency();

create trigger transaction_codings_updated_at
  before update on transaction_codings
  for each row execute function set_updated_at();
