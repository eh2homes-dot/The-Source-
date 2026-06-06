// sites/workday.js — example custom scraper for Workday-hosted career sites.
//
// Workday powers the big public REITs (Invitation Homes, AMH, etc.). It has no
// free public API, so we drive a headless browser, let the JS render, and read
// the listings. Workday DOES expose an internal JSON endpoint per tenant that's
// far more stable than scraping the DOM — we use that when we can find it.
//
// Each Workday tenant has a URL shaped like:
//   https://{tenant}.wd{N}.myworkdayjobs.com/{site}
// and an internal POST endpoint:
//   https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
//
// You find {tenant}, {N}, and {site} by opening the company's careers page and
// copying the URL. Fill those into config.js.

import { chromium } from "playwright";

export async function scrapeWorkday({ tenant, wd, site }) {
  const endpoint = `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const jobs = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let offset = 0;
    const limit = 20;
    // Workday returns paginated JSON via POST; loop until we've pulled everything.
    while (true) {
      const resp = await page.request.post(endpoint, {
        headers: { "Content-Type": "application/json" },
        data: { appliedFacets: {}, limit, offset, searchText: "" },
      });
      if (!resp.ok()) break;
      const body = await resp.json();
      const postings = body.jobPostings || [];
      for (const p of postings) {
        jobs.push({
          title: p.title,
          location: p.locationsText || "See listing",
          dept: "General",
          url: `https://${tenant}.${wd}.myworkdayjobs.com/${site}${p.externalPath}`,
          type: p.timeType || "Full-time",
        });
      }
      offset += limit;
      if (offset >= (body.total || 0) || postings.length === 0) break;
    }
  } finally {
    await browser.close();
  }
  return jobs;
}

// sites/generic.js pattern — for non-Workday pages, scrape the rendered DOM.
// Provide CSS selectors per site in config.js. Kept here as a reference template.
export async function scrapeGenericDOM({ url, selectors }) {
  const jobs = [];
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(selectors.row, { timeout: 15000 }).catch(() => {});
    const rows = await page.$$(selectors.row);
    for (const row of rows) {
      const title = await row.$eval(selectors.title, (el) => el.textContent.trim()).catch(() => null);
      if (!title) continue;
      const location = selectors.location
        ? await row.$eval(selectors.location, (el) => el.textContent.trim()).catch(() => "See listing")
        : "See listing";
      const url = selectors.link
        ? await row.$eval(selectors.link, (el) => el.href).catch(() => null)
        : null;
      jobs.push({ title, location, dept: "General", url, type: "Full-time" });
    }
  } finally {
    await browser.close();
  }
  return jobs;
}
