-- 015_add_missing_overhead_categories.sql
-- Fills the few gaps between the seeded overhead taxonomy (005) and the P&L
-- page's requested category list: everything else the owner asked for
-- already existed (e.g. "marketing advisor" -> Marketing Consultant,
-- "office expenses" -> Office Supplies).

do $$
declare
  sales_marketing_id uuid;
  general_admin_id   uuid;
begin
  select id into sales_marketing_id from categories where type = 'overhead' and name = 'Sales & Marketing' and parent_id is null;
  select id into general_admin_id from categories where type = 'overhead' and name = 'General & Administrative' and parent_id is null;

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', sales_marketing_id, 'Agency Fees', 13);

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', general_admin_id, 'Postage', 8),
    ('overhead', general_admin_id, 'Computers & Office Equipment', 9);
end $$;
