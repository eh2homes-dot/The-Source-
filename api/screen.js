// api/screen.js — server-side proxy for AI résumé screening.
//
// The Anthropic API key stays HERE (read from process.env.ANTHROPIC_API_KEY),
// never in the browser. Two ways this runs:
//   • Local dev: called by the Vite dev middleware in vite.config.js (npm run dev)
//   • Production: as a Vercel serverless function at POST /api/screen
//
// Request  JSON: { hub, jobTitle, company, resume, linkedin? }
// Response JSON: { analysis: "...text..." }   (or { error } with a 4xx/5xx status)

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6"; // current Sonnet
const ANTHROPIC_VERSION = "2023-06-01";

function buildPrompt({ hub, jobTitle, company, resume, linkedin }) {
  const role = hub === "proptech" ? "Proptech recruiter" : "Senior SFR recruiter";
  const li = linkedin ? `LinkedIn: ${linkedin}. ` : "";
  return (
    `You are a ${role}. Analyze this candidate for the role "${jobTitle}" at ${company}. ` +
    `Respond in EXACTLY this format and nothing else:\n` +
    `STRENGTHS:\n- ...\nGAPS:\n- ...\nMATCH SCORE: XX/100\n\n` +
    `${li}Resume / background:\n${resume}`
  );
}

// Core call — reused by both the Vercel handler and the Vite dev middleware.
export async function screenResume(input) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set on the server.");
    err.statusCode = 500;
    throw err;
  }
  if (!input || !input.resume || !String(input.resume).trim()) {
    const err = new Error("Missing résumé text.");
    err.statusCode = 400;
    throw err;
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Don't leak auth/config detail to the browser — log server-side, surface 502.
    console.error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
    const err = new Error("Upstream AI service error.");
    err.statusCode = 502;
    throw err;
  }

  const data = await res.json();
  return data?.content?.[0]?.text || "Analysis complete.";
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel may pre-parse
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// Vercel serverless entrypoint (also works with any Node http server).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  try {
    const analysis = await screenResume(await readJsonBody(req));
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ analysis }));
  } catch (e) {
    res.statusCode = e.statusCode || 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: e.message }));
  }
}
