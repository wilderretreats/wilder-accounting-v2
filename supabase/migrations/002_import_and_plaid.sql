-- 002_import_and_plaid.sql
-- Created before `transactions` because transactions references both.

-- ---------------------------------------------------------------------------
-- import_batches — CSV imports and historical migration runs.
-- ---------------------------------------------------------------------------
create table import_batches (
  id           uuid primary key default gen_random_uuid(),
  source       text not null check (source in ('csv', 'excel_migration', 'plaid_backfill')),
  file_name    text,
  imported_by  uuid references profiles(id),
  row_count    int,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plaid_items / plaid_accounts — split (not conflated like the old app).
-- No user_id scoping: this is shared team infrastructure, not private data
-- belonging to whoever happened to click "Connect."
-- ---------------------------------------------------------------------------
create table plaid_items (
  id                       uuid primary key default gen_random_uuid(),
  institution_name         text,
  institution_id           text,
  item_id                  text not null unique,
  access_token_encrypted   text not null,   -- AES-256-GCM ciphertext, base64
  access_token_iv          text not null,
  access_token_tag         text not null,
  cursor                   text,
  status                   text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_sync_at             timestamptz,
  last_sync_error          text,
  connected_by             uuid references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger plaid_items_updated_at
  before update on plaid_items
  for each row execute function set_updated_at();

create table plaid_accounts (
  id                uuid primary key default gen_random_uuid(),
  plaid_item_id     uuid not null references plaid_items(id) on delete cascade,
  plaid_account_id  text not null unique,
  name              text not null,
  mask              text,      -- last 4 digits only — never store full account numbers
  subtype           text,      -- checking, credit card, etc.
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index plaid_accounts_item_idx on plaid_accounts(plaid_item_id);
