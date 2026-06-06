-- Founders & Friends — click tracking
-- ---------------------------------------------------------------------------
-- Creates public.job_clicks: one row each time a visitor clicks through from a
-- listing to the real job posting on the company's site. The app writes these
-- from the browser using the PUBLISHABLE (anon) key, so Row Level Security is
-- enabled and the anon role may INSERT only — it can never read, update, or
-- delete clicks. Reporting is done server-side (service_role bypasses RLS), the
-- same security posture the `applicants` table already uses.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and click Run.
--   (Supabase Dashboard → your project → SQL Editor → New query → paste → Run)
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists public.job_clicks (
  id          bigint generated always as identity primary key,
  job_id      text,          -- the listing id (e.g. "gh-123", "lv-456", or a Supabase row id)
  job_title   text,
  company     text,
  hub         text,          -- 'opco' or 'proptech'
  url         text,          -- the real posting the visitor was sent to
  source      text,          -- 'greenhouse' | 'lever' | 'supabase' | 'workday' ...
  clicked_at  timestamptz not null default now()
);

-- Reporting indexes
create index if not exists job_clicks_clicked_at_idx on public.job_clicks (clicked_at desc);
create index if not exists job_clicks_company_idx     on public.job_clicks (company);
create index if not exists job_clicks_hub_idx         on public.job_clicks (hub);

-- Lock the table down
alter table public.job_clicks enable row level security;

-- Let the browser (anon role) record clicks — INSERT only, nothing else.
grant insert on public.job_clicks to anon, authenticated;

drop policy if exists "anon can insert job clicks" on public.job_clicks;
create policy "anon can insert job clicks"
  on public.job_clicks
  for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- Reporting helpers (run these any time in the SQL editor):
--
--   -- total clicks per company, most clicked first
--   select company, hub, count(*) as clicks
--   from job_clicks group by company, hub order by clicks desc;
--
--   -- clicks in the last 7 days
--   select date_trunc('day', clicked_at) as day, count(*)
--   from job_clicks where clicked_at > now() - interval '7 days'
--   group by day order by day;
-- ---------------------------------------------------------------------------
