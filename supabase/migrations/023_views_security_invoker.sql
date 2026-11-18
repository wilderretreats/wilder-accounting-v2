-- Supabase security advisor: "Security Definer View".
-- Postgres views run with the view owner's rights by default, which skips
-- row level security on the tables underneath. Switching them to
-- security_invoker makes them respect RLS for whoever is querying.
-- Every select policy on transactions, transaction_codings, categories,
-- retreats and retreat_locks allows any signed-in user, so the app sees
-- the same numbers; only signed-out (anon) access is cut off.

alter view public.overhead_monthly_actuals set (security_invoker = true);
alter view public.retreat_actuals set (security_invoker = true);
