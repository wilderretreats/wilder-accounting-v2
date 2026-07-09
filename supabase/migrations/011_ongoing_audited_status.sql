-- 011_ongoing_audited_status.sql
-- Replaces the upcoming/in_progress/completed/cancelled status (which the
-- historical migration hardcoded to "completed" for every retreat
-- regardless of actual date, per the user's own report) with a two-state
-- model that mirrors the existing retreat_locks mechanism exactly:
-- "ongoing" (not locked) or "audited" (has an active lock). This is
-- trigger-maintained, not just set at creation time, so it can never drift
-- from the actual lock state regardless of which code path locks/unlocks a
-- retreat.

create type retreat_status_v2 as enum ('ongoing', 'audited');

alter table retreats add column status_v2 retreat_status_v2 not null default 'ongoing';

update retreats r
set status_v2 = case
  when exists (
    select 1 from retreat_locks rl
    where rl.retreat_id = r.id and rl.unlocked_at is null
  ) then 'audited'::retreat_status_v2
  else 'ongoing'::retreat_status_v2
end;

alter table retreats drop column status;
drop type retreat_status;

alter table retreats rename column status_v2 to status;
alter type retreat_status_v2 rename to retreat_status;

create function sync_retreat_status_from_lock()
returns trigger
language plpgsql
as $$
declare
  affected_retreat_id uuid := coalesce(new.retreat_id, old.retreat_id);
begin
  update retreats
  set status = case
    when exists (
      select 1 from retreat_locks
      where retreat_id = affected_retreat_id and unlocked_at is null
    ) then 'audited'::retreat_status
    else 'ongoing'::retreat_status
  end
  where id = affected_retreat_id;
  return coalesce(new, old);
end;
$$;

-- Covers both locking (insert) and unlocking (update of unlocked_at on the
-- existing row) -- every current and future lock/unlock code path goes
-- through inserting or updating this table, so there's no separate path
-- that could set status out of sync.
create trigger retreat_locks_sync_status
  after insert or update on retreat_locks
  for each row execute function sync_retreat_status_from_lock();
