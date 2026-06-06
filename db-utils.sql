-- Founders & Friends — DB utilities
-- The old seed file generated placeholder jobs; that's gone. Jobs come only
-- from the scraper service + live ATS APIs now. Use these to inspect state.

-- Current live job counts by hub
select hub, count(*) as jobs from jobs where active = true group by hub;

-- Jobs per company (who's actually populated)
select company, hub, count(*) as roles
from jobs where active = true
group by company, hub
order by roles desc;

-- Wipe all jobs (e.g., to re-sync cleanly from the scraper)
-- truncate table jobs restart identity;

-- Recent applications
select name, email, company, job_title, status, applied_at
from applicants order by applied_at desc limit 50;
