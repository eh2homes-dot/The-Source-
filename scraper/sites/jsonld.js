// sites/jsonld.js — scrape careers sites that list each job page in an XML
// sitemap and embed a JobPosting JSON-LD block on each page. This is how
// Paradox.ai-hosted career sites (e.g. Invitation Homes) expose their roles.
// Plain HTTP only — no headless browser needed, so it's stable and cheap.
//
// config.js usage:
//   { company: "Invitation Homes", hub: "opco", method: "jsonld",
//     sitemap: "https://careers.invitationhomes.com/sitemap.xml" }
// Optional: jobUrlPattern (regex string) to match job-detail URLs (default: "/job/").

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const MAX_JOBS = 300; // safety cap on per-page fetches

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function locs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export async function scrapeJsonLd({ sitemap, jobUrlPattern }) {
  if (!sitemap) throw new Error('jsonld scraper needs a "sitemap" URL in config');
  const isJob = jobUrlPattern ? new RegExp(jobUrlPattern) : /\/job\//;

  // The top sitemap may be an index of child sitemaps, or list jobs directly.
  const top = locs(await getText(sitemap));
  let jobUrls = top.filter((u) => isJob.test(u));
  if (jobUrls.length === 0) {
    const children = top.filter((u) => /sitemap/i.test(u) && u.endsWith(".xml"));
    for (const child of children) {
      try {
        jobUrls.push(...locs(await getText(child)).filter((u) => isJob.test(u)));
      } catch { /* skip unreadable child sitemap */ }
    }
  }
  jobUrls = [...new Set(jobUrls)].slice(0, MAX_JOBS);

  const jobs = [];
  for (const url of jobUrls) {
    try {
      const html = await getText(url);
      const blocks = [
        ...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ].map((m) => m[1]);
      for (const raw of blocks) {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { continue; }
        for (const it of Array.isArray(parsed) ? parsed : [parsed]) {
          if (!it || it["@type"] !== "JobPosting") continue;
          let loc = it.jobLocation;
          if (Array.isArray(loc)) loc = loc[0];
          const addr = (loc && loc.address) || {};
          const location =
            [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ") || "See listing";
          const type = Array.isArray(it.employmentType)
            ? it.employmentType[0] || "Full-time"
            : it.employmentType || "Full-time";
          if (it.title) jobs.push({ title: it.title, location, dept: "General", url: it.url || url, type });
        }
      }
    } catch { /* skip unreadable job page — never inject placeholder data */ }
  }
  return jobs;
}
