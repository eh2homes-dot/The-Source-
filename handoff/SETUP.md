# Bringing Founders & Friends into Claude Code

Follow these in order. Everything in `outputs/` should be downloaded first.

## 1. Scaffold the project

```bash
mkdir founders-and-friends && cd founders-and-friends
npm create vite@latest . -- --template react
npm install
```

## 2. Drop in the files

From what you downloaded:
- `recruiting-site.jsx`  →  rename to `src/App.jsx` (overwrite the default)
- `handoff/index.html`   →  replace the project's `index.html`
- `handoff/CLAUDE.md`    →  place in project root (Claude Code reads this for context)
- `scraper/`             →  copy the whole folder into the project root
- `db-utils.sql`         →  keep handy for Supabase SQL editor

Make sure `src/main.jsx` imports App:
```jsx
import App from "./App.jsx";
```

## 3. Open Claude Code

```bash
claude
```

It will read `CLAUDE.md` automatically. Then give it this first prompt:

> Read CLAUDE.md. Then: (1) confirm src/App.jsx loads with `npm run dev` and fix any
> import/syntax errors, (2) the AI résumé screening calls api.anthropic.com from the
> browser — move that behind a Vite serverless/proxy endpoint so the key stays
> server-side, and rewire the analyze() calls to it, (3) set up the /scraper service:
> npm install, create .env from .env.example, and do a dry run of `npm run scrape`.

## 4. Things you'll provide when asked
- **Anthropic API key** — for the screening proxy (server-side only)
- **Supabase service_role key** — for `scraper/.env` (Settings → API → secret key)
- The publishable key + project URL are already in `src/App.jsx`

## 5. First real data
Once the scraper runs, add confirmed companies to `scraper/config.js` and run
`npm run scrape`. Jobs appear in the app immediately (it reads live from Supabase).

## 6. Deploy (when ready)
Ask Claude Code to deploy the frontend to Vercel or Netlify, and schedule the
scraper as a cron job (GitHub Actions, Render Cron, or Railway). The README in
`/scraper` has the cron snippet.
