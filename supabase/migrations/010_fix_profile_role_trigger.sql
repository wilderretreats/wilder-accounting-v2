-- 010_fix_profile_role_trigger.sql
-- 007's enforce_profile_role_change() only ever checked has_role(auth.uid(), ...),
-- which is NULL for service-role connections (no JWT `sub` claim) — meaning the
-- admin-only user-invite/role-management API routes, which must use the
-- service-role client (they call the Supabase Auth Admin API), would have been
-- blocked from ever setting a role. Service-role connections are already
-- privileged (RLS-bypassing) by definition, so explicitly allow them here too.

create or replace function enforce_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and auth.role() <> 'service_role'
     and not has_role(auth.uid(), array['admin']) then
    raise exception 'Only admins can change role or is_active on a profile';
  end if;
  return new;
end;
$$;
