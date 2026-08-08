-- 019_retreat_contract_fields.sql
-- Contract-level figures, set independently of coded transactions -- the
-- quoted/contracted revenue and profit for a retreat, plus passenger count.
-- These exist to forecast before a retreat is audited: the "Expected P&L"
-- view and dashboard totals fall back to these for any retreat that hasn't
-- been audited yet, since its actual coded transactions are still incomplete
-- by definition.

alter table retreats add column contract_value numeric(12,2);
alter table retreats add column contract_profit numeric(12,2);
alter table retreats add column passenger_count integer;

comment on column retreats.contract_value is
  'Contracted/quoted revenue for this retreat, entered independent of coded transactions. Used as the forecast revenue for ongoing (not yet audited) retreats.';
comment on column retreats.contract_profit is
  'Contracted/quoted profit for this retreat, same forecast purpose as contract_value.';
comment on column retreats.passenger_count is
  'Number of passengers/guests contracted for this retreat.';
