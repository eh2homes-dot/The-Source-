// run.js — the scraper entrypoint.
//
//   node run.js                 # scrape every company in config.js
//   node run.js --hub=opco      # only OpCo companies
//   node run.js --hub=proptech  # only Proptech companies
//
// Requires env vars SUPABASE_URL and SUPABASE_SERVICE_KEY (see .env.example).
// Schedule it with cron (see README.md) to keep listings fresh.

import { COMPANIES } from "./config.js";
import { fetchGreenhouse, fetchLever, fetchBreezy, fetchWorkable, fetchEsusu } from "./ats.js";
import { scrapeWorkday, scrapeGenericDOM } from "./sites/workday.js";
import { scrapeJsonLd } from "./sites/jsonld.js";
import { scrapeReffie } from "./sites/reffie.js";
import { syncCompanyJobs, countCompanyJobs } from "./supabase.js";
import { appendFileSync } from "node:fs";

const hubArg = process.argv.find((a) => a.startsWith("--hub="));
const hubFilter = hubArg ? hubArg.split("=")[1] : null;

async function getJobsFor(c) {
  let jobs;
  switch (c.method) {
    case "greenhouse": jobs = await fetchGreenhouse(c.token, c.company); break;
    case "lever":      jobs = await fetchLever(c.token, c.company); break;
    case "breezy":     jobs = await fetchBreezy(c.token, c.company); break;
    case "workable":   jobs = await fetchWorkable(c.token, c.company); break;
    case "esusu":      jobs = await fetchEsusu(c); break;
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
  const problems = []; // { company, kind: "error" | "dropped", detail }

  for (const c of targets) {
    try {
      const before = await countCompanyJobs(c.company, c.hub);
      const jobs = await getJobsFor(c);
      const n = await syncCompanyJobs(c.company, c.hub, jobs);
      total += n;
      console.log(`  ✓ ${c.company.padEnd(28)} ${n} live roles`);
      // A source that had roles yesterday and returns none today has usually moved
      // its careers page (e.g. Reffie, Nov 2026). Flag it once; tomorrow "before" is 0.
      if (before > 0 && n === 0) {
        problems.push({ company: c.company, kind: "dropped", detail: `had ${before} roles, now 0 — check whether their careers page moved` });
      }
    } catch (err) {
      // A failed source must NOT inject fake data — we keep its existing rows and move on.
      console.error(`  ✗ ${c.company.padEnd(28)} ${err.message}`);
      problems.push({ company: c.company, kind: "error", detail: err.message.split("\n")[0] });
    }
  }

  console.log(`\nDone. ${total} total roles synced to Supabase.`);

  if (problems.length) {
    console.log(`\n${problems.length} source(s) need attention:`);
    for (const p of problems) {
      const title = p.kind === "error" ? `${p.company}: scrape failed` : `${p.company}: dropped to 0 roles`;
      // GitHub Actions annotation — shows on the run page (plain text when run locally).
      console.log(`::error title=${title}::${p.detail}`);
    }
  }

  // Run summary on the GitHub Actions run page.
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [`### Job scrape: ${total} roles synced`, ""];
    if (problems.length) {
      lines.push("| Company | Problem |", "|---|---|");
      for (const p of problems) lines.push(`| ${p.company} | ${p.kind === "error" ? "Failed: " : ""}${p.detail.replace(/\|/g, "/")} |`);
    } else {
      lines.push("All sources scraped cleanly.");
    }
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }

  // Mark the run failed so GitHub emails you. Every working source has already
  // synced by this point — this only makes the problem visible.
  if (problems.length) process.exitCode = 1;
}

main();
