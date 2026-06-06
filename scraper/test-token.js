// test-token.js — verify an ATS board token returns the RIGHT company's real
// jobs BEFORE you add it to config.js. Prints the board/company name, the live
// job count, and a few sample titles + locations so you can eyeball that it's
// the company you intend (guards against name-collision tokens like the
// Greenhouse "evernest" = a German firm, or "haven" = a video-game studio).
//
// Usage:
//   node test-token.js greenhouse esusu
//   node test-token.js lever lessen
//   node test-token.js breezy property-meld
//   node test-token.js ashby <token>

const UA = { "User-Agent": "Mozilla/5.0 (compatible; FoundersFriendsTokenCheck/1.0)" };

const [, , atsArg, token] = process.argv;
if (!atsArg || !token) {
  console.log("Usage: node test-token.js <greenhouse|lever|breezy|ashby> <token>");
  process.exit(2);
}
const ats = atsArg.toLowerCase();

function report(name, jobs) {
  console.log(`  ATS: ${ats}   token: "${token}"`);
  console.log(`  Board / company name: ${name || "(not exposed by this ATS)"}`);
  console.log(`  Live jobs: ${jobs.length}`);
  jobs.slice(0, 6).forEach((j) => console.log(`    • ${j.title}  —  ${j.location || "?"}`));
  if (jobs.length > 6) console.log(`    …and ${jobs.length - 6} more`);
  console.log(
    jobs.length
      ? `  → RETURNS JOBS. Confirm the name/titles above are the company you intend before adding to config.js.`
      : `  → Board reachable but 0 open roles (or wrong token). Confirm the name matches before relying on it.`
  );
}

try {
  if (ats === "greenhouse") {
    const meta = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}`, { headers: UA });
    if (!meta.ok) { console.log(`  ✗ HTTP ${meta.status} — no Greenhouse board for token "${token}".`); process.exit(1); }
    const name = (await meta.json()).name;
    const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`, { headers: UA });
    const jobs = ((await r.json()).jobs || []).map((j) => ({ title: j.title, location: j.location?.name }));
    report(name, jobs);
  } else if (ats === "lever") {
    const r = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`, { headers: UA });
    if (!r.ok) { console.log(`  ✗ HTTP ${r.status} — no Lever board for token "${token}".`); process.exit(1); }
    const d = await r.json();
    if (!Array.isArray(d)) { console.log(`  ✗ Unexpected Lever response for token "${token}".`); process.exit(1); }
    const jobs = d.map((j) => ({ title: j.text, location: j.categories?.location }));
    const slug = d[0]?.hostedUrl ? new URL(d[0].hostedUrl).pathname.split("/")[1] : token;
    report(`jobs.lever.co/${slug}`, jobs);
  } else if (ats === "breezy") {
    const r = await fetch(`https://${token}.breezy.hr/json`, { headers: UA });
    if (!r.ok) { console.log(`  ✗ HTTP ${r.status} — no Breezy board for token "${token}".`); process.exit(1); }
    const d = await r.json();
    if (!Array.isArray(d)) { console.log(`  ✗ Unexpected Breezy response for token "${token}".`); process.exit(1); }
    const jobs = d.map((j) => ({ title: j.name, location: j.location?.name }));
    report(d[0]?.company?.name || null, jobs);
  } else if (ats === "ashby") {
    const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${token}?includeCompensation=false`, { headers: UA });
    if (!r.ok) { console.log(`  ✗ HTTP ${r.status} — no Ashby board for token "${token}".`); process.exit(1); }
    const d = await r.json();
    const jobs = (d.jobs || []).map((j) => ({ title: j.title, location: j.location }));
    report(d.name || null, jobs);
  } else {
    console.log(`  Unknown ATS "${ats}". Use one of: greenhouse | lever | breezy | ashby.`);
    process.exit(2);
  }
} catch (e) {
  console.log(`  ✗ Error: ${e.message}`);
  process.exit(1);
}
