# Founders & Friends — Project Brief for Claude Code

A dual-hub recruiting platform for the single-family rental (SFR) industry.

## Critical domain rule (never violate)
**Proptech companies sell products/services to operators. Operators manage doors.**
These two groups must NEVER be conflated. The app has two separate hubs reflecting this:
- **OpCo Hub** — property management companies / SFR operators (professional seafoam aesthetic, Playfair Display + DM Sans)
- **Proptech Hub** — technology vendors selling to operators (psychedelic neon aesthetic, Orbitron + DM Sans)

## Architecture
```
career pages / ATS APIs ──► scraper service ──► Supabase `jobs` table ──► React app
                                                  `applicants` table ◄──── application form
```
- **Frontend:** single-file React component (`src/App.jsx`). Reads jobs from Supabase REST API + live Greenhouse/Lever boards. Writes applications to Supabase.
- **Scraper:** standalone Node service in `/scraper`. Fetches REAL jobs only and writes to Supabase. No fake/placeholder data anywhere in this project — that's a hard rule.
- **Database:** Supabase (Postgres). Tables `jobs` and `applicants` already created.

## Real data only
There is NO mock/seed/placeholder job data. If a source returns nothing, the UI shows an empty state ("No open roles right now"). Never reintroduce generated jobs.

## Known wiring tasks (help me with these)
1. **AI résumé screening** currently calls `api.anthropic.com` directly from the browser. That can't ship — move it behind a serverless function / small proxy so the API key stays server-side. Wire the frontend `analyze()` calls to the proxy.
2. **Supabase keys:** the publishable key is in `src/App.jsx` (safe for browser). The scraper needs the service_role key in `scraper/.env` (never in frontend, never in git).
3. **Scraper:** `npm install` in `/scraper` pulls Playwright. Companies are configured in `scraper/config.js`. Run with `npm run scrape`.

## Stack
- Vite + React (no TypeScript)
- Styling: inline styles in the component (no Tailwind/CSS framework)
- Fonts: Google Fonts loaded in `index.html`
- Data: Supabase REST via `fetch()` — `@supabase/supabase-js` only needed in the scraper

## Don't
- Don't add placeholder/demo jobs
- Don't merge proptech and operator companies
- Don't put the service_role key or Anthropic key in frontend code
- Don't over-format the UI; keep each hub's distinct aesthetic
