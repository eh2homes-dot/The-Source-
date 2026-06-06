# Founders & Friends — Job Scraper Service

Pulls **real** job listings and writes them to Supabase. The frontend reads from
Supabase, so this service is what keeps the platform populated. No fake data is
ever generated — if a source returns nothing, that company simply shows no roles.

## Source tiers (in order of preference)

1. **Greenhouse / Lever APIs** — structured JSON, free, reliable. Always use these when available.
2. **Workday** — no public API, but each tenant exposes an internal JSON endpoint the scraper hits via a headless browser. More stable than DOM scraping.
3. **Generic DOM scrape** — last resort for JS-rendered pages with no API. Provide CSS selectors per site. Fragile: will break when a company redesigns, so expect maintenance.

## Setup

```bash
cd scraper
npm install            # installs deps + Playwright Chromium
cp .env.example .env   # then paste your Supabase URL + SERVICE ROLE key
```

> Use the **service_role** (secret) key here — server-side only. Never the publishable key, and never commit `.env`.

## Configure companies

Open `config.js` and add a row per company. Find the source from its careers URL:

| Careers URL contains | Config |
|---|---|
| `boards.greenhouse.io/TOKEN` | `{ method: "greenhouse", token: "TOKEN" }` |
| `jobs.lever.co/TOKEN` | `{ method: "lever", token: "TOKEN" }` |
| `TENANT.wdN.myworkdayjobs.com/SITE` | `{ method: "workday", tenant, wd, site }` |
| anything else | `{ method: "dom", url, selectors }` |

Only companies in `config.js` get scraped. Leaving one out = it shows no jobs (correct).

## Run

```bash
npm run scrape            # all companies
npm run scrape:opco       # operators only
npm run scrape:proptech   # proptech only
```

Each run **replaces** a company's existing jobs with the fresh scrape, so closed roles drop off and new ones appear automatically.

## Schedule (keep listings fresh)

Add a cron job to run it, e.g. every 6 hours:

```bash
# crontab -e
0 */6 * * * cd /path/to/scraper && /usr/bin/node run.js >> scrape.log 2>&1
```

Or host it on any scheduler — GitHub Actions (cron workflow), Render Cron Jobs, Railway, a small VM, or a Supabase Edge Function with a scheduled trigger.

## How it connects to the app

```
career pages / ATS APIs ──► scraper (this service) ──► Supabase `jobs` table ──► React app reads it
```

The React app already reads `jobs` from Supabase and also pulls Greenhouse/Lever
live at page load (via its `LIVE_BOARDS` config) for instant freshness on those.
Use this scraper for everything that isn't a clean API.
