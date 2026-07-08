-- 007_rls_policies.sql
-- RLS on every table. v1 has no per-client restrictions (small internal
-- team, everyone can see everything), but every select policy is centered
-- on the has_role() helper so a later per-client restriction is one added
-- `exists(...)` clause per policy, not a rewrite.

create function has_role(uid uuid, allowed_roles text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = uid and is_active = true and role = any(allowed_roles)
  );
$$;

-- Prevent a non-admin from ever changing role/is_active, including on their
-- own row (RLS row policies can't restrict individual columns).
create function enforce_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and not has_role(auth.uid(), array['admin']) then
    raise exception 'Only admins can change role or is_active on a profile';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_role_change
  before update on profiles
  for each row execute function enforce_profile_role_change();

alter table profiles enable row level security;
alter table ops_owners enable row level security;
alter table clients enable row level security;
alter table categories enable row level security;
alter table retreats enable row level security;
alter table import_batches enable row level security;
alter table plaid_items enable row level security;
alter table plaid_accounts enable row level security;
alter table transactions enable row level security;
alter table transaction_codings enable row level security;
alter table retreat_locks enable row level security;
alter table audit_log enable row level security;

-- profiles: everyone can see everyone (small team); users can update their
-- own row (role/is_active guarded by the trigger above); admins can update
-- any row.
create policy profiles_select on profiles for select
  using (auth.uid() is not null);
create policy profiles_update_self on profiles for update
  using (auth.uid() = id);
create policy profiles_update_admin on profiles for update
  using (has_role(auth.uid(), array['admin']));

-- ops_owners, clients, categories, retreats: full read for any authenticated
-- user; writes restricted to admin/ops.
create policy ops_owners_select on ops_owners for select using (auth.uid() is not null);
create policy ops_owners_write on ops_owners for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy clients_select on clients for select using (auth.uid() is not null);
create policy clients_write on clients for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy categories_select on categories for select using (auth.uid() is not null);
create policy categories_write on categories for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy retreats_select on retreats for select using (auth.uid() is not null);
create policy retreats_write on retreats for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy retreat_locks_select on retreat_locks for select using (auth.uid() is not null);
create policy retreat_locks_write on retreat_locks for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

-- transactions / transaction_codings: full read for any authenticated user;
-- writes restricted to admin/ops. (Plaid sync writes via the service-role
-- client from lib/supabase/admin.ts, which bypasses RLS entirely — it never
-- runs in a user session context.)
create policy transactions_select on transactions for select using (auth.uid() is not null);
create policy transactions_write on transactions for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy transaction_codings_select on transaction_codings for select using (auth.uid() is not null);
create policy transaction_codings_write on transaction_codings for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy import_batches_select on import_batches for select using (auth.uid() is not null);
create policy import_batches_write on import_batches for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

-- plaid_items / plaid_accounts: admin/ops can read (need it to sync/see
-- connection status); only admin can connect/disconnect. Never exposed to
-- viewer — access_token_* stay encrypted regardless, but there's no reason
-- to widen visibility of connection metadata beyond the operating team.
create policy plaid_items_select on plaid_items for select
  using (has_role(auth.uid(), array['admin', 'ops']));
create policy plaid_items_write on plaid_items for all
  using (has_role(auth.uid(), array['admin']))
  with check (has_role(auth.uid(), array['admin']));

create policy plaid_accounts_select on plaid_accounts for select
  using (has_role(auth.uid(), array['admin', 'ops']));
create policy plaid_accounts_write on plaid_accounts for all
  using (has_role(auth.uid(), array['admin']))
  with check (has_role(auth.uid(), array['admin']));

-- audit_log: append-only from server-side routes using the service-role
-- client (bypasses RLS) — no insert policy for the `authenticated` role at
-- all. Select open to every authenticated user (small team, full
-- transparency into who changed what).
create policy audit_log_select on audit_log for select using (auth.uid() is not null);
