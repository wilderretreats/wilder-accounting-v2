-- 017_overhead_autocode_rules.sql
-- Keyword rules for the recurring overhead vendors seen in the Overhead
-- Transactions CSV import, so re-imports of the same card auto-code instead
-- of needing to be hand-coded every time (see /api/import and
-- /api/transactions/autocode, both of which only ever auto-code Overhead
-- matches -- Revenue/COGS still need a human to pick the retreat).

do $$
declare
  search_ads_id uuid;
  insurance_id  uuid;
  software_id   uuid;
begin
  select id into search_ads_id from categories where type = 'overhead' and name = 'Search Ads';
  select id into insurance_id  from categories where type = 'overhead' and name = 'Insurance';
  select id into software_id   from categories where type = 'overhead' and name = 'Software & Subscriptions';

  -- Matches the "GOOGLE *ADS<digits>" card descriptor seen in the actual feed.
  insert into category_rules (keyword, category_id) values
    ('GOOGLE *ADS', search_ads_id);

  insert into category_rules (keyword, category_id) values
    ('STATE FARM', insurance_id),
    ('NEXT INSURANCE', insurance_id);

  insert into category_rules (keyword, category_id) values
    ('QWILR', software_id),
    ('SLACK', software_id),
    ('WETRAVEL', software_id),
    ('WPM', software_id),
    ('LOVABLE', software_id),
    ('AUTOMATTIC', software_id),
    ('OPENAI', software_id),
    ('CLAUDE', software_id),
    ('FORBES', software_id);
end $$;
