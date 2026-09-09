-- 021_categories_is_tax.sql
-- Marks the top-level "Taxes" overhead category so the P&L can break it out
-- into its own section (with a "Net Income before Taxes" subtotal above it),
-- the same way is_flight_cost (001) carves flights out of COGS.

alter table categories add column is_tax boolean not null default false;

update categories set is_tax = true
where type = 'overhead' and parent_id is null and name = 'Taxes';

comment on column categories.is_tax is
  'Marks the top-level overhead category (children inherit via parent_id) that the P&L breaks '
  'out as its own "Taxes" section, separate from other overhead, to show Net Income before Taxes.';
