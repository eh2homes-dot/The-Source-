// supabase.js — write layer for the scraper service.
// Uses the SERVICE ROLE key (server-side only — NEVER ship this to the browser).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars. See .env.example.");
  process.exit(1);
}

export const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Replace all jobs for a given company with a fresh scrape.
// This keeps listings current: stale roles disappear, new ones appear.
export async function syncCompanyJobs(company, hub, jobs) {
  // 1. Remove this company's existing rows (so closed roles drop off)
  const { error: delErr } = await supabase
    .from("jobs")
    .delete()
    .eq("company", company)
    .eq("hub", hub);
  if (delErr) { console.error(`  ✗ delete failed for ${company}:`, delErr.message); return 0; }

  if (jobs.length === 0) return 0;

  // 2. Insert the fresh batch
  const rows = jobs.map((j) => ({
    title: j.title,
    company,
    location: j.location || "Remote",
    dept: j.dept || "General",
    type: j.type || "Full-time",
    salary: j.salary || null,
    hub,
    url: j.url || null,
    active: true,
  }));

  const { error: insErr } = await supabase.from("jobs").insert(rows);
  if (insErr) { console.error(`  ✗ insert failed for ${company}:`, insErr.message); return 0; }
  return rows.length;
}
