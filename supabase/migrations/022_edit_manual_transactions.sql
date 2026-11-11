-- 022_edit_manual_transactions.sql
-- Lets the team edit a manually entered transaction's description, date and
-- amount in place -- mainly so "Pending" placeholders can be adjusted during
-- final reconciliations instead of being deleted and re-added.
--
-- Why a function and not a plain UPDATE: transaction_codings rows must sum
-- exactly to their transaction's amount (deferred constraint trigger from
-- 014). Changing the amount of a coded transaction therefore has to move
-- its coding amount in the same database transaction, which one RPC call
-- guarantees.
--
-- Rules:
--   * Only source = 'manual' rows. Bank/card-fed data stays read-only.
--   * Not while the transaction is coded to a locked retreat (same rule
--     coding already follows), so audited numbers can't drift.
--   * Amount can't be zero.
--   * Single coding: its amount follows the new transaction amount.
--   * Split across several codings: the amount can't change until the
--     split is collapsed to one coding -- there's no safe way to guess how
--     the difference should be divided.
--
-- security invoker so the existing transactions_update RLS policy
-- (admin/ops/ops_manager) gates it exactly as if the caller ran the UPDATE
-- directly.

create function edit_manual_transaction(
  p_transaction_id uuid,
  p_description text,
  p_posted_date date,
  p_amount numeric(12,2),
  p_actor_id uuid
)
returns transactions
language plpgsql
security invoker
as $$
declare
  v_txn transactions;
  v_coding_count integer;
  v_new_amount numeric(12,2);
begin
  select * into v_txn
  from transactions
  where id = p_transaction_id and is_deleted_by_source = false
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  if v_txn.source <> 'manual' then
    raise exception 'Only manually entered transactions can be edited';
  end if;

  if exists (
    select 1
    from transaction_codings tc
    join retreat_locks rl on rl.retreat_id = tc.retreat_id and rl.unlocked_at is null
    where tc.transaction_id = p_transaction_id
  ) then
    raise exception 'This transaction is coded to a locked retreat. Unlock the retreat before editing it.';
  end if;

  v_new_amount := coalesce(p_amount, v_txn.amount);
  if v_new_amount = 0 then
    raise exception 'Amount can''t be zero';
  end if;

  select count(*) into v_coding_count
  from transaction_codings where transaction_id = p_transaction_id;

  if v_new_amount <> v_txn.amount and v_coding_count > 1 then
    raise exception 'This transaction is split across % codings. Combine it into one coding before changing the amount, then re-split.', v_coding_count;
  end if;

  update transactions set
    description = coalesce(nullif(btrim(p_description), ''), description),
    posted_date = coalesce(p_posted_date, posted_date),
    amount = v_new_amount
  where id = p_transaction_id
  returning * into v_txn;

  if v_coding_count = 1 then
    update transaction_codings set
      amount = v_new_amount,
      updated_by = p_actor_id,
      updated_at = now()
    where transaction_id = p_transaction_id
      and amount <> v_new_amount;
  end if;

  return v_txn;
end;
$$;

grant execute on function edit_manual_transaction(uuid, text, date, numeric, uuid) to authenticated;
