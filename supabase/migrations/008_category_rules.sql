-- 008_category_rules.sql
-- Keyword-based auto-coding rules, kept from the old app's concept but fixed
-- to reference categories.id via FK instead of a free-text category name.

create table category_rules (
  id           uuid primary key default gen_random_uuid(),
  keyword      text not null,
  category_id  uuid not null references categories(id) on delete cascade,
  priority     int not null default 0,
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create index category_rules_keyword_idx on category_rules (lower(keyword));

alter table category_rules enable row level security;

create policy category_rules_select on category_rules for select using (auth.uid() is not null);
create policy category_rules_write on category_rules for all
  using (has_role(auth.uid(), array['admin', 'ops']))
  with check (has_role(auth.uid(), array['admin', 'ops']));
