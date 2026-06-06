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
