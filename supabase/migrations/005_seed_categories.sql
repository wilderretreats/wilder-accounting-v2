-- 005_seed_categories.sql
-- Seed default categories. Revenue/COGS stay flat (one level). Overhead uses
-- a real 2-level hierarchy, matching the taxonomy the team already tracks
-- day-to-day (confirmed against the "Category Rules" tab and the Dashboard's
-- "Expense Breakdown by Subcategory" section of the working income statement).

-- Revenue (flat)
insert into categories (type, name, sort_order) values
  ('revenue', 'Client Payment', 1),
  ('revenue', 'Commission', 2),
  ('revenue', 'Rebate', 3),
  ('revenue', 'Refund/Guest Payment', 4);

-- COGS (flat; is_flight_cost drives the AllFly ex-flights toggle)
insert into categories (type, name, is_flight_cost, sort_order) values
  ('cogs', 'Lodging', false, 1),
  ('cogs', 'Hotel Meals', false, 2),
  ('cogs', 'Hotel Activities', false, 3),
  ('cogs', 'Flights/Airfare', true, 4),
  ('cogs', 'Activities', false, 5),
  ('cogs', 'Transportation', false, 6),
  ('cogs', 'Meals Off-Site', false, 7),
  ('cogs', 'Meetings & A/V', false, 8),
  ('cogs', 'Staff Travel', false, 9),
  ('cogs', 'Site Visit', false, 10),
  ('cogs', 'DMC/Third-Party DMC', false, 11),
  ('cogs', 'SWAG', false, 12),
  ('cogs', 'Photography/Videography', false, 13),
  ('cogs', 'Rental (Furniture/Plant)', false, 14),
  ('cogs', 'Decor', false, 15),
  ('cogs', 'Signage', false, 16),
  ('cogs', 'Facilitator', false, 17);

-- Overhead (2-level)
do $$
declare
  sales_marketing_id uuid;
  general_admin_id   uuid;
  personnel_id       uuid;
  professional_id    uuid;
  taxes_id           uuid;
begin
  insert into categories (type, name, sort_order) values ('overhead', 'Sales & Marketing', 1) returning id into sales_marketing_id;
  insert into categories (type, name, sort_order) values ('overhead', 'General & Administrative', 2) returning id into general_admin_id;
  insert into categories (type, name, sort_order) values ('overhead', 'Personnel', 3) returning id into personnel_id;
  insert into categories (type, name, sort_order) values ('overhead', 'Professional Fees', 4) returning id into professional_id;
  insert into categories (type, name, sort_order) values ('overhead', 'Research & Development', 5);
  insert into categories (type, name, sort_order) values ('overhead', 'Taxes', 6) returning id into taxes_id;

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', sales_marketing_id, 'Email Prospecting', 1),
    ('overhead', sales_marketing_id, 'Search Ads', 2),
    ('overhead', sales_marketing_id, 'LinkedIn Consultant', 3),
    ('overhead', sales_marketing_id, 'LinkedIn Ads', 4),
    ('overhead', sales_marketing_id, 'Marketing Consultant', 5),
    ('overhead', sales_marketing_id, 'Website Consultant', 6),
    ('overhead', sales_marketing_id, 'Sales Consultant', 7),
    ('overhead', sales_marketing_id, 'Sales Travel', 8),
    ('overhead', sales_marketing_id, 'Referral Commissions', 9),
    ('overhead', sales_marketing_id, 'SEM Consultant', 10),
    ('overhead', sales_marketing_id, 'SEO Consultant', 11),
    ('overhead', sales_marketing_id, 'Videography & Photography', 12);

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', general_admin_id, 'Gear', 1),
    ('overhead', general_admin_id, 'Insurance', 2),
    ('overhead', general_admin_id, 'Office Rent', 3),
    ('overhead', general_admin_id, 'Office Supplies', 4),
    ('overhead', general_admin_id, 'Phone', 5),
    ('overhead', general_admin_id, 'Software & Subscriptions', 6),
    ('overhead', general_admin_id, 'Bank Fees', 7);

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', personnel_id, 'Payroll', 1),
    ('overhead', personnel_id, 'Payroll Fees', 2),
    ('overhead', personnel_id, 'Payroll Taxes', 3),
    ('overhead', personnel_id, 'Contract Labor', 4),
    ('overhead', personnel_id, 'Health Insurance', 5),
    ('overhead', personnel_id, 'Reimbursement', 6),
    ('overhead', personnel_id, 'Employee Gifts', 7),
    ('overhead', personnel_id, 'Company Retreat', 8),
    ('overhead', personnel_id, 'Salaries & Wages', 9);

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', professional_id, 'Business Insurance', 1),
    ('overhead', professional_id, 'Professional Fees', 2),
    ('overhead', professional_id, 'Legal', 3),
    ('overhead', professional_id, 'Accounting Fees', 4);

  insert into categories (type, parent_id, name, sort_order) values
    ('overhead', taxes_id, 'Federal Income Tax', 1),
    ('overhead', taxes_id, 'State Income Tax', 2);
end $$;
