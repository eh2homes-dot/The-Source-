// sites/reffie.js — custom scraper for Reffie's Framer-hosted careers page.
// Reffie (proptech: leasing CRM/workflow for rental operators) takes applications
// by email and has no public ATS board, but its careers site is server-rendered:
//   - the listing https://reffie.me/jobs links to /jobs/<slug> detail pages
//   - each detail page exposes a clean <meta property="og:title"> of the form
//     "Reffie | <Role> - <Location>"
// Plain HTTP only. This is a fragile, site-specific scraper (Framer markup can
// change) — it deliberately skips anything it can't parse rather than guess, so
// it never injects placeholder data.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

export async function scrapeReffie({ listUrl = "https://reffie.me/jobs" } = {}) {
  const origin = new URL(listUrl).origin;
  const html = await getText(listUrl);

  // Collect job-detail slugs from the listing (e.g. jobs/growth-lead).
  const slugs = [
    ...new Set([...html.matchAll(/jobs\/([a-z0-9][a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase())),
  ].filter((s) => s !== "jobs");

  const jobs = [];
  for (const slug of slugs) {
    const url = `${origin}/jobs/${slug}`;
    try {
      const page = await getText(url);
      const og = (page.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || [])[1];
      if (!og) continue;
      // "Reffie | Growth Lead - Austin"  ->  title "Growth Lead", location "Austin"
      const t = og.replace(/^\s*Reffie\s*[|｜]\s*/i, "").trim();
      let title = t;
      let location = "Remote";
      const dash = t.lastIndexOf(" - ");
      if (dash > -1) {
        title = t.slice(0, dash).trim();
        location = t.slice(dash + 3).trim();
      }
      if (title) jobs.push({ title, location, dept: "General", url, type: "Full-time" });
    } catch {
      /* skip unreadable detail page — never inject placeholder data */
    }
  }
  return jobs;
}
