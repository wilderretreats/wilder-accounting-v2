-- 001_initial_schema.sql
-- Core entities: profiles, ops_owners, clients, categories, retreats.
-- Client != Retreat: a client is a company; a retreat is one engagement (own dates/status/owner).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  role        text not null default 'ops' check (role in ('admin', 'ops', 'viewer')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user is created.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ops_owners — lookup of who operationally runs a retreat.
-- Kept separate from profiles: an owner is a display name for retreat
-- ownership, which doesn't always map to a login (historical names, team
-- members without system access yet).
-- ---------------------------------------------------------------------------
create table ops_owners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- clients — deliberately thin. No dates, no revenue, no owner: those all
-- belong on retreats.
-- ---------------------------------------------------------------------------
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  notes       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- categories — 2-level via self-reference. Serves both the Overhead
-- hierarchy (e.g. Sales & Marketing -> Search Ads) and the COGS
-- "Lodging + Hotel Meals + Hotel Activities" rollup grouping.
-- ---------------------------------------------------------------------------
create type category_type as enum ('revenue', 'cogs', 'overhead');

create table categories (
  id              uuid primary key default gen_random_uuid(),
  type            category_type not null,
  parent_id       uuid references categories(id) on delete restrict,
  name            text not null,
  is_flight_cost  boolean not null default false,
  is_active       boolean not null default true,
  sort_order      int not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  -- `nulls not distinct` (PG15+) so two top-level categories (parent_id is null)
  -- of the same type/name are also caught — plain `unique` would let them through,
  -- since NULL is never equal to NULL under standard uniqueness semantics.
  constraint categories_unique_name_per_parent unique nulls not distinct (type, parent_id, name)
);

create index categories_type_idx on categories(type);
create index categories_parent_idx on categories(parent_id);

-- A child category must share its parent's type — FKs alone can't express this.
create function enforce_category_parent_type()
returns trigger
language plpgsql
as $$
declare
  parent_type category_type;
begin
  if new.parent_id is not null then
    select type into parent_type from categories where id = new.parent_id;
    if parent_type is null then
      raise exception 'Parent category % does not exist', new.parent_id;
    end if;
    if parent_type <> new.type then
      raise exception 'Category type (%) must match parent category type (%)', new.type, parent_type;
    end if;
  end if;
  return new;
end;
$$;

create trigger categories_enforce_parent_type
  before insert or update on categories
  for each row execute function enforce_category_parent_type();

-- ---------------------------------------------------------------------------
-- retreats — one row per engagement. A client can have zero, one, or many.
-- ---------------------------------------------------------------------------
create type retreat_status as enum ('upcoming', 'in_progress', 'completed', 'cancelled');

create table retreats (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete restrict,
  name            text not null,
  retreat_month   date not null,
  start_date      date,
  end_date        date,
  status          retreat_status not null default 'upcoming',
  ops_owner_id    uuid references ops_owners(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint retreats_unique_engagement unique (client_id, name, retreat_month),
  constraint retreats_month_is_first_of_month check (extract(day from retreat_month) = 1)
);

create index retreats_client_idx on retreats(client_id);
create index retreats_month_idx on retreats(retreat_month);
create index retreats_owner_idx on retreats(ops_owner_id);
create index retreats_status_idx on retreats(status);

create trigger retreats_updated_at
  before update on retreats
  for each row execute function set_updated_at();
