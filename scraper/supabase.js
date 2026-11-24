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

// How many rows this company has right now (before we replace them). Used to
// flag a source that suddenly drops to zero — usually a sign the careers page moved.
export async function countCompanyJobs(company, hub) {
  const { count, error } = await supabase
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("company", company)
    .eq("hub", hub);
  if (error) return null; // unknown — don't block the sync over a count
  return count ?? 0;
}

// Replace all jobs for a given company with a fresh scrape.
// Throws on a database error so run.js reports it instead of logging "0 live roles".
// This keeps listings current: stale roles disappear, new ones appear.
export async function syncCompanyJobs(company, hub, jobs) {
  // 1. Remove this company's existing rows (so closed roles drop off)
  const { error: delErr } = await supabase
    .from("jobs")
    .delete()
    .eq("company", company)
    .eq("hub", hub);
  if (delErr) throw new Error(`Supabase delete failed: ${delErr.message}`);

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
  if (insErr) throw new Error(`Supabase insert failed: ${insErr.message}`);
  return rows.length;
}
