// run.js — the scraper entrypoint.
//
//   node run.js                 # scrape every company in config.js
//   node run.js --hub=opco      # only OpCo companies
//   node run.js --hub=proptech  # only Proptech companies
//
// Requires env vars SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env.example).
// Schedule it with cron (see README.md) to keep listings fresh.

import { COMPANIES } from "./config.js";
import { fetchGreenhouse, fetchLever, fetchBreezy } from "./ats.js";
import { scrapeWorkday, scrapeGenericDOM } from "./sites/workday.js";
import { scrapeJsonLd } from "./sites/jsonld.js";
import { scrapeReffie } from "./sites/reffie.js";
import { syncCompanyJobs } from "./supabase.js";

const hubArg = process.argv.find((a) => a.startsWith("--hub="));
const hubFilter = hubArg ? hubArg.split("=")[1] : null;

async function getJobsFor(c) {
  let jobs;
  switch (c.method) {
    case "greenhouse": jobs = await fetchGreenhouse(c.token, c.company); break;
    case "lever":      jobs = await fetchLever(c.token, c.company); break;
    case "breezy":     jobs = await fetchBreezy(c.token, c.company); break;
    case "workday":    jobs = await scrapeWorkday(c); break;
    case "jsonld":     jobs = await scrapeJsonLd(c); break;
    case "reffie":     jobs = await scrapeReffie(c); break;
    case "dom":        jobs = await scrapeGenericDOM(c); break;
    default:           throw new Error(`Unknown method "${c.method}" for ${c.company}`);
  }
  // Some companies keep their public ATS pages disabled and embed listings on
  // their own careers site (e.g. Belong). When a careersUrl override is set,
  // point every job link there so visitors reach a working page, not a dead URL.
  if (c.careersUrl) jobs = jobs.map((j) => ({ ...j, url: c.careersUrl }));
  return jobs;
}

async function main() {
  const targets = COMPANIES.filter((c) => !hubFilter || c.hub === hubFilter);
  if (targets.length === 0) {
    console.log("No companies configured for this run. Add entries to config.js.");
    return;
  }

  console.log(`Scraping ${targets.length} companies${hubFilter ? ` (${hubFilter})` : ""}…\n`);
  let total = 0;

  for (const c of targets) {
    try {
      const jobs = await getJobsFor(c);
      const n = await syncCompanyJobs(c.company, c.hub, jobs);
      total += n;
      console.log(`  ✓ ${c.company.padEnd(28)} ${n} live roles`);
    } catch (err) {
      // A failed source must NOT inject fake data — we just log and move on.
      console.error(`  ✗ ${c.company.padEnd(28)} ${err.message}`);
    }
  }

  console.log(`\nDone. ${total} total roles synced to Supabase.`);
}

main();
