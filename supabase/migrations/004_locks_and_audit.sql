-- 004_locks_and_audit.sql
-- retreat_locks: append-only lock/unlock event log (not a single locked_at
-- column) so full lock history is preserved and "currently locked" is one
-- indexed lookup.
-- audit_log: append-only, semantic events written from application code
-- (not a generic trigger diff — triggers can't cleanly capture "which user"
-- under Supabase's RLS/JWT model, and semantic action names are more useful
-- than raw column diffs).

create table retreat_locks (
  id            uuid primary key default gen_random_uuid(),
  retreat_id    uuid not null references retreats(id) on delete cascade,
  locked_by     uuid not null references profiles(id),
  locked_at     timestamptz not null default now(),
  unlocked_by   uuid references profiles(id),
  unlocked_at   timestamptz,
  constraint retreat_locks_unlock_consistency check (
    (unlocked_at is null and unlocked_by is null) or
    (unlocked_at is not null and unlocked_by is not null)
  )
);

create index retreat_locks_retreat_idx on retreat_locks(retreat_id);

-- At most one *active* lock per retreat at a time.
create unique index retreat_locks_one_active_lock on retreat_locks(retreat_id) where unlocked_at is null;

-- Defense-in-depth: block writes to transaction_codings for a currently-locked
-- retreat, even if the application layer's own check is somehow bypassed.
-- Admins must unlock first — no silent bypass role.
create function enforce_retreat_not_locked()
returns trigger
language plpgsql
as $$
begin
  if new.retreat_id is not null and exists (
    select 1 from retreat_locks
    where retreat_id = new.retreat_id and unlocked_at is null
  ) then
    raise exception 'Retreat % is locked; unlock it before coding transactions', new.retreat_id;
  end if;
  return new;
end;
$$;

create trigger transaction_codings_enforce_not_locked
  before insert or update on transaction_codings
  for each row execute function enforce_retreat_not_locked();

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
create table audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references profiles(id),
  action       text not null,
  entity_type  text not null,
  entity_id    uuid not null,
  before       jsonb,
  after        jsonb,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log(entity_type, entity_id);
create index audit_log_actor_idx on audit_log(actor_id);
create index audit_log_created_idx on audit_log(created_at desc);
create index audit_log_action_idx on audit_log(action);
