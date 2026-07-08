-- 006_views.sql
-- Computed reporting — never stored/duplicated. Per-client and company-wide
-- monthly rollups are built on top of this view in lib/reports/queries.ts
-- rather than as additional SQL views, since they need the AllFly
-- (?exclude_flights=true) toggle and CSV-export shaping at the query layer.

create view retreat_actuals as
select
  r.id as retreat_id,
  r.client_id,
  r.retreat_month,
  coalesce(sum(t.amount) filter (where c.type = 'revenue'), 0) as revenue,
  coalesce(sum(-t.amount) filter (where c.type = 'cogs'), 0) as cogs,
  coalesce(sum(-t.amount) filter (where c.type = 'cogs' and c.is_flight_cost), 0) as flight_cogs
from retreats r
left join transaction_codings tc on tc.retreat_id = r.id
left join transactions t on t.id = tc.transaction_id and t.is_deleted_by_source = false
left join categories c on c.id = tc.category_id
group by r.id, r.client_id, r.retreat_month;

comment on view retreat_actuals is
  'gross_profit = revenue - cogs. margin = gross_profit / nullif(revenue, 0). '
  'AllFly ex-flights view: cogs_ex_flights = cogs - flight_cogs (revenue unchanged) — '
  'computed in the application layer, not duplicated here.';

create view overhead_monthly_actuals as
select
  date_trunc('month', t.posted_date)::date as month,
  c.id as category_id,
  c.parent_id as category_parent_id,
  coalesce(sum(-t.amount), 0) as amount
from transactions t
join transaction_codings tc on tc.transaction_id = t.id
join categories c on c.id = tc.category_id
where c.type = 'overhead' and t.is_deleted_by_source = false
group by date_trunc('month', t.posted_date), c.id, c.parent_id;

comment on view overhead_monthly_actuals is
  'Overhead has no retreat to borrow a month from, so it rolls up under its own posted_date month '
  '(matching how the old sheet pasted Overhead rows directly into whichever month''s tab).';
