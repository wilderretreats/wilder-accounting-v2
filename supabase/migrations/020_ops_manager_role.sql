-- 020_ops_manager_role.sql
-- New role: "ops_manager" -- everything "ops" can do, plus the one thing
-- ops can't: unlock an audited retreat (previously admin-only per
-- 004_locks_and_audit.sql's "no silent bypass role" comment -- that
-- constraint was about not letting *ops* silently bypass an admin review,
-- not about admin being the only role capable of it). Implemented by
-- widening every existing admin/ops policy and role check to also accept
-- ops_manager, then separately granting it the unlock action that plain
-- ops still doesn't have.

-- Looked up by inspecting pg_constraint rather than assuming the
-- auto-generated name (profiles_role_check), so this doesn't silently no-op
-- if the constraint was ever renamed.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%in%';

  if v_constraint_name is not null then
    execute format('alter table profiles drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'ops', 'ops_manager', 'viewer'));

-- ---------------------------------------------------------------------------
-- RLS: widen every admin/ops policy from 007_rls_policies.sql to admin/ops/ops_manager
-- ---------------------------------------------------------------------------

drop policy ops_owners_write on ops_owners;
create policy ops_owners_write on ops_owners for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy clients_write on clients;
create policy clients_write on clients for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy categories_write on categories;
create policy categories_write on categories for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy retreats_write on retreats;
create policy retreats_write on retreats for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy retreat_locks_write on retreat_locks;
create policy retreat_locks_write on retreat_locks for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy transaction_codings_write on transaction_codings;
create policy transaction_codings_write on transaction_codings for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy import_batches_write on import_batches;
create policy import_batches_write on import_batches for all
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy plaid_items_select on plaid_items;
create policy plaid_items_select on plaid_items for select
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy plaid_accounts_select on plaid_accounts;
create policy plaid_accounts_select on plaid_accounts for select
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

-- transactions_update / transactions_delete replaced transactions_write in
-- 012_transactions_manual_insert_all_roles.sql; transactions_insert stays
-- open to every authenticated role and is untouched here.
drop policy transactions_update on transactions;
create policy transactions_update on transactions for update
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']))
  with check (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

drop policy transactions_delete on transactions;
create policy transactions_delete on transactions for delete
  using (has_role(auth.uid(), array['admin', 'ops', 'ops_manager']));

-- plaid_items_write / plaid_accounts_write (connect/disconnect a bank feed)
-- and profiles_update_admin (role/user management) stay admin-only --
-- ops_manager's extra authority is scoped to unlocking, not to admin's
-- other account-wide powers.
