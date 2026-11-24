// ats.js — official ATS API fetchers (preferred over scraping; structured + reliable).

export async function fetchGreenhouse(token, company) {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`);
  if (!res.ok) throw new Error(`Greenhouse ${token} → ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    title: j.title,
    location: j.location?.name || "Remote",
    dept: j.departments?.[0]?.name || "General",
    url: j.absolute_url,
    type: "Full-time",
  }));
}

export async function fetchLever(token, company) {
  const res = await fetch(`https://api.lever.co/v0/postings/${token}?mode=json`);
  if (!res.ok) throw new Error(`Lever ${token} → ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((j) => ({
    title: j.text,
    location: j.categories?.location || "Remote",
    dept: j.categories?.team || j.categories?.department || "General",
    url: j.hostedUrl,
    type: j.categories?.commitment || "Full-time",
  }));
}

// Breezy HR exposes a public JSON board at https://{token}.breezy.hr/json.
// Used by smaller proptech vendors (e.g. Property Meld, Showdigs).
export async function fetchBreezy(token, company) {
  const res = await fetch(`https://${token}.breezy.hr/json`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FoundersFriendsScraper/1.0)" },
  });
  if (!res.ok) throw new Error(`Breezy ${token} → ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((j) => ({
    title: j.name,
    location: j.location?.name || "Remote",
    dept: j.department || "General",
    url: j.url,
    type: j.type?.name || "Full-time",
  }));
}

// Workable exposes a public JSON widget feed at
// https://apply.workable.com/api/v1/widget/accounts/{token} (token = the slug in
// apply.workable.com/{token}). Used by Belong (moved off Lever in 2026).
export async function fetchWorkable(token, company) {
  const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${token}`);
  if (!res.ok) throw new Error(`Workable ${token} → ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map((j) => ({
    title: j.title,
    location: j.telecommuting
      ? "Remote"
      : [j.city, j.state, j.country].filter(Boolean).join(", ") || "Remote",
    dept: j.department || "General",
    url: j.url || j.shortlink,
    type: j.employment_type || "Full-time",
  }));
}

// Esusu moved off Greenhouse to Deel in 2026. Their careers page loads roles from
// their own public JSON endpoint; each role's apply page lives on jobs.deel.com.
export async function fetchEsusu({ listUrl, deelBoard }) {
  const res = await fetch(listUrl);
  if (!res.ok) throw new Error(`Esusu careers API → ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((j) => ({
    title: (j.title || "").trim(),
    location: (j.locations || []).join(" / ") || "Remote",
    dept: j.departments?.[0] || "General",
    url: `https://jobs.deel.com/${deelBoard}/job-details/${j.id}/overview`,
    type: j.employment_types?.[0] || "Full-time",
  }));
}
