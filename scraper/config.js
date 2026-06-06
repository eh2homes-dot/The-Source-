// config.js — the source of truth for WHERE each company's jobs come from.
//
// method: "greenhouse" | "lever" | "breezy" | "workday" | "jsonld" | "dom"
//
// HOW TO FILL THIS IN — open the company's careers page and look at the URL:
//   boards.greenhouse.io/TOKEN          → { method: "greenhouse", token: "TOKEN" }
//   jobs.lever.co/TOKEN                 → { method: "lever", token: "TOKEN" }
//   TOKEN.breezy.hr                     → { method: "breezy", token: "TOKEN" }
//   TENANT.wdN.myworkdayjobs.com/SITE   → { method: "workday", tenant, wd, site }
//   Paradox.ai careersite w/ sitemap    → { method: "jsonld", sitemap: "https://…/sitemap.xml" }
//   anything else (JS-rendered list)    → { method: "dom", url, selectors }
//
// Only companies listed here get scraped. Add rows as you confirm each source.
// Leaving a company out simply means it shows no jobs until you wire it up —
// which is correct: real jobs only, never invented.
//
// Every token below was verified live against the public ATS API on 2026-06-06
// (it returns that company's real jobs). Re-verify before adding new ones —
// token-name collisions happen (e.g. Greenhouse "evernest" is a German company,
// NOT the US SFR manager, so it is deliberately excluded).

export const COMPANIES = [
  // ── OpCo (operators — companies that manage doors) ───────────────────────────
  { company: "Belong", hub: "opco", method: "lever", token: "belong", careersUrl: "https://belonghome.com/careers" }, // Belong Home — SFR rental management. Public Lever pages are disabled (every jobs.lever.co/belong link 404s), so job links point to their working careers site (verified ~44 roles)

  // FirstKey Homes runs a custom "FKH Careers" site with no public Greenhouse/
  // Lever/Workday API we could find (the "firstkeyhomes" Greenhouse token 404s).
  // It needs a confirmed Workday tenant/site or DOM selectors before it can be
  // scraped — left out so we never invent jobs for it.
  // { company: "FirstKey Homes", hub: "opco", method: "greenhouse", token: "firstkeyhomes" },

  // Big REIT operators run Workday. tenant/wd/site below were captured from each
  // company's real careers URL and verified live against the cxs/jobs feed on 2026-06-06.
  { company: "Progress Residential", hub: "opco", method: "workday", tenant: "pretiumenterpriseservices", wd: "wd1", site: "PR" },     // Progress Residential careers run under parent Pretium Enterprise Services (verified ~50)
  { company: "Tricon Residential",   hub: "opco", method: "workday", tenant: "tricon",                    wd: "wd3", site: "tricon" }, // verified ~19

  // Invitation Homes' careers site is Paradox.ai (NOT Workday — the legacy
  // invitationhomes.wd1.myworkdayjobs.com/INVH Workday host is dead, 422/500). The Paradox
  // site lists every job in an XML sitemap and embeds JobPosting JSON-LD on each page, which
  // is plain-HTTP readable. Verified ~25 real roles on 2026-06-06.
  { company: "Invitation Homes", hub: "opco", method: "jsonld", sitemap: "https://careers.invitationhomes.com/sitemap.xml" },
  // { company: "AMH", hub: "opco", method: "workday", tenant: "amh", wd: "wd1", site: "AMH" },

  // ── Proptech (technology vendors — companies that sell to operators) ──────────
  { company: "Lessen",      hub: "proptech", method: "lever",      token: "lessen" },     // property maintenance/renovation tech (verified ~56)
  { company: "Roofstock",   hub: "proptech", method: "greenhouse", token: "roofstock" },  // SFR investment marketplace/platform (verified ~52)
  { company: "Findigs",     hub: "proptech", method: "lever",      token: "findigs" },     // rental application & screening software (verified ~12)
  { company: "Esusu",       hub: "proptech", method: "greenhouse", token: "esusu" },       // rent reporting / credit building (verified ~9)
  { company: "Flock Homes", hub: "proptech", method: "greenhouse", token: "flockhomes" },  // 721-exchange platform for SFR owners (verified ~3)
  { company: "Kiavi",       hub: "proptech", method: "greenhouse", token: "kiavi" },       // lending/fintech for real-estate investors (verified ~1)

  // Added 2026-06-06 (each board confirmed to belong to the right company before adding):
  { company: "Property Meld", hub: "proptech", method: "breezy",     token: "property-meld" }, // maintenance coordination SaaS, Breezy HR board (verified ~4)
  { company: "Showdigs",      hub: "proptech", method: "breezy",     token: "showdigs" },      // self-touring / showing coordination, Breezy HR board (verified — board live, 0 open right now)
  { company: "Lineage",       hub: "proptech", method: "greenhouse", token: "lineagehq" },     // real-estate investing infrastructure for SFR, Greenhouse (verified — board live, 0 open right now)
  { company: "Reffie",        hub: "proptech", method: "reffie",     listUrl: "https://reffie.me/jobs" }, // leasing CRM/workflow; custom scrape of their Framer careers page (verified ~3)

  // Requested but NOT wired (no machine-readable public job feed found on 2026-06-06 — real jobs only):
  //   Second Nature  → JazzHR board (secondnature.applytojob.com); 0 open and no public JSON feed. Will wire an HTML scraper once they post a role we can validate against.
  //   Nutiliti       → no careers page or ATS at all (recruits via LinkedIn/Built In).
  //   Revela         → Webflow careers + HubSpot form; no ATS feed, 0 open.
  //   Series         → ambiguous/name-collision, not a confirmed SFR-proptech vendor; no feed.
  //   Lighthouse     → mylighthouse.co (deposit alternatives); no public feed. NB: Greenhouse "lighthouse" is an UNRELATED hospitality-tech company — do NOT use.
  //   Haven          → usehaven.ai (AI maintenance); recruits via YC workatastartup. NB: Greenhouse "haven" is an UNRELATED video-game studio — do NOT use.
];
