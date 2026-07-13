-- 012_transactions_manual_insert_all_roles.sql
-- Manual transaction entry (source = 'manual') is available to every role,
-- including viewer -- but editing/deleting a transaction after the fact
-- stays admin/ops only, same as before. transactions_write covered insert
-- and update/delete with one policy, so it has to split into an insert
-- policy (any authenticated active user) and an update/delete policy
-- (admin/ops, unchanged) rather than just widening the existing one.

drop policy transactions_write on transactions;

create policy transactions_insert on transactions for insert
  with check (auth.uid() is not null);

create policy transactions_update on transactions for update
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));

create policy transactions_delete on transactions for delete
  using (has_role(auth.uid(), array['admin', 'ops']));
