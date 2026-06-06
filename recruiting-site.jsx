import { useState, useEffect } from "react";

async function fetchGreenhouseJobs(boardToken, companyName) {
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`);
    const data = await res.json();
    return (data.jobs || []).slice(0, 8).map(j => ({
      id: `gh-${j.id}`, title: j.title, company: companyName,
      location: j.location?.name || "Remote",
      dept: j.departments?.[0]?.name || "General",
      url: j.absolute_url, type: "Full-time", posted: "Live", source: "greenhouse",
    }));
  } catch { return []; }
}

async function fetchLeverJobs(boardToken, companyName) {
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${boardToken}?mode=json`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 8).map(j => ({
      id: `lv-${j.id}`, title: j.text, company: companyName,
      location: j.categories?.location || "Remote",
      dept: j.categories?.team || j.categories?.department || "General",
      url: j.hostedUrl, type: j.categories?.commitment || "Full-time", posted: "Live", source: "lever",
    }));
  } catch { return []; }
}

// Live ATS boards — add { company, ats, token } rows as you confirm them.
// Find the token in a company's careers URL:
//   boards.greenhouse.io/TOKEN   → ats: "greenhouse"
//   jobs.lever.co/TOKEN          → ats: "lever"
const LIVE_BOARDS = {
  opco: [
    // Jobs now come from Supabase (populated by the scraper service), so no
    // browser-side live boards are needed here. The "firstkeyhomes" Greenhouse
    // token 404s (FirstKey runs a custom careers site), so it was removed to
    // avoid a dead request on every page load. Add { company, ats, token } rows
    // only for boards you've confirmed return jobs.
  ],
  proptech: [
    // { company: "EliseAI", ats: "greenhouse", token: "eliseai" },
    // { company: "Esusu", ats: "greenhouse", token: "esusu" },
    // { company: "Findigs", ats: "greenhouse", token: "findigs" },
  ],
};

async function fetchLiveBoards(hub) {
  const boards = LIVE_BOARDS[hub] || [];
  const results = await Promise.all(boards.map(b =>
    b.ats === "lever" ? fetchLeverJobs(b.token, b.company) : fetchGreenhouseJobs(b.token, b.company)
  ));
  return results.flat();
}

// ─── COMPANY ROSTERS (50 operators + 50 proptech) ───────────────────────────
const OPCO_COMPANIES = [
  "Invitation Homes","Progress Residential","AMH","Amherst","FirstKey Homes",
  "Tricon Residential","VineBrook Homes","Maymont Homes","GTIS Partners","Sylvan Road",
  "Resicap","Darwin Homes","Bridge Single-Family","Roots","Haven Realty Capital",
  "AMH Development","Christopher Todd Communities","NexMetro Communities","BB Living","Quinn Residences",
  "Wan Bridge","Taylor Morrison","Quarterra","Camillo Properties","Cavco",
  "Evernest","PURE HomeRiver","Mynd","Renters Warehouse","Real Property Management",
  "Specialized Property Management","Keyrenter","Belong","33 Realty","McCreary Realty",
  "Bay Property Management Group","RPM Living","Siegel Group","Tarantino Properties","Atlas Real Estate",
  "Flock Homes","Doorvest","SmartRent Homes","Second Avenue","Gatsby Investment",
  "JWB Real Estate Capital","REI Nation","HomeRiver Group","Picket Homes","Up&Up",
];

const PROPTECH_COMPANIES = [
  "Yardi","RealPage","AppFolio","Entrata","MRI Software",
  "Buildium","Propertyware","Rent Manager","DoorLoop","RentRedi",
  "Second Nature","Latchel","Amenify","Esusu","Flex",
  "Till","Jetty","Rhino","LeaseLock","Domuso",
  "Funnel Leasing","Knock","Rently","TransUnion SmartMove","Snappt",
  "Findigs","Plaid","Zillow Rentals","Apartments.com","Zumper",
  "SmartRent","PointCentral","Lessen","EliseAI","Travtus",
  "Property Meld","Lula","HappyCo","Dwelo","Kasa",
  "Roofstock","HouseCanary","Juniper Square","Cherre","Plunk",
  "Doorvest Invest","Entera","Honeycomb","Obie","Ascendix",
];

const OPCO_PALETTE = ["#1e4b8f","#8b1a1a","#0e9e8a","#c8722e","#2db87a","#3a6ea5","#7a5195","#bc5090","#558b6e","#1b998b","#005f73","#0a9396","#3d5a80","#5c4d7d","#8a5a44","#6b705c","#b07d62","#2d6a4f","#9e2a2b","#264653"];
const PROPTECH_PALETTE = ["#00ccff","#cc44ff","#ff4488","#00ffaa","#ff6600","#9900ff","#00ddff","#ff00cc","#ffcc00","#44ccff"];

const BRAND_COLORS = {
  "Invitation Homes":"#1e4b8f","Progress Residential":"#8b1a1a","FirstKey Homes":"#0e9e8a",
  "RealPage":"#cc44ff","Second Nature":"#00ffaa","Yardi":"#00ccff","AppFolio":"#00ddff",
};

const COMPANY_COLORS = {};
OPCO_COMPANIES.forEach((n,i)=>{ COMPANY_COLORS[n] = BRAND_COLORS[n] || OPCO_PALETTE[i % OPCO_PALETTE.length]; });
PROPTECH_COMPANIES.forEach((n,i)=>{ COMPANY_COLORS[n] = BRAND_COLORS[n] || PROPTECH_PALETTE[i % PROPTECH_PALETTE.length]; });

// NOTE: Jobs are REAL only — sourced from live ATS APIs (Greenhouse/Lever) and
// the scraper service that writes into Supabase. No generated/placeholder data.


// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SB_URL = "https://ddajpnfxoirbhrithlfh.supabase.co";
const SB_KEY = "sb_publishable_1tqySblhiPaxWb6Dzwd9ug_D8rrAS7E";
const SB_H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

async function sbFetchJobs(hub) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/jobs?active=eq.true&hub=eq.${hub}&select=*&order=created_at.desc`, { headers: SB_H });
    const d = await r.json();
    if (!Array.isArray(d) || d.length === 0) return [];
    return d.map(j => ({ id: j.id, title: j.title, company: j.company, location: j.location, dept: j.dept, type: j.type, salary: j.salary, posted: `${Math.max(1, Math.floor((Date.now() - new Date(j.created_at)) / 86400000))}d ago`, url: j.url || "#", source: "supabase", featured: j.featured }));
  } catch { return []; }
}

async function sbFetchApplicants(hub) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/applicants?hub=eq.${hub}&select=*&order=applied_at.desc`, { headers: SB_H });
    const d = await r.json();
    if (!Array.isArray(d)) return [];
    return d.map(a => ({ id: a.id, name: a.name, email: a.email, phone: a.phone, currentRole: a.current_position, linkedin: a.linkedin, resume: a.resume, aiAnalysis: a.ai_analysis, score: a.score, jobTitle: a.job_title, company: a.company, appliedAt: a.applied_at, status: a.status }));
  } catch { return []; }
}

async function sbSaveApplicant(hub, data) {
  try {
    await fetch(`${SB_URL}/rest/v1/applicants`, { method: "POST", headers: SB_H, body: JSON.stringify({ hub, name: data.name, email: data.email, phone: data.phone || null, current_position: data.currentRole || null, linkedin: data.linkedin || null, resume: data.resume, ai_analysis: data.aiAnalysis || null, score: data.score || null, job_title: data.jobTitle, company: data.company, status: "New" }) });
  } catch (e) { console.error("sbSaveApplicant:", e); }
}

async function sbUpdateStatus(id, status) {
  try {
    await fetch(`${SB_URL}/rest/v1/applicants?id=eq.${id}`, { method: "PATCH", headers: SB_H, body: JSON.stringify({ status }) });
  } catch (e) { console.error("sbUpdateStatus:", e); }
}

// Fire-and-forget: record a click-through to a real job posting. Never blocks or
// breaks the UI — if the job_clicks table isn't set up yet, the error is swallowed.
async function sbTrackClick(job, hub) {
  if (!job) return;
  try {
    await fetch(`${SB_URL}/rest/v1/job_clicks`, {
      method: "POST",
      headers: { ...SB_H, Prefer: "return=minimal" },
      body: JSON.stringify({
        job_id: job.id != null ? String(job.id) : null,
        job_title: job.title || null,
        company: job.company || null,
        hub,
        url: job.url || null,
        source: job.source || null,
      }),
    });
  } catch (e) { console.error("sbTrackClick:", e); }
}

const DEPT_ICON = (dept = "") => {
  const d = dept.toLowerCase();
  if (d.includes("engineer") || d.includes("tech")) return "⬡";
  if (d.includes("product")) return "◈";
  if (d.includes("design")) return "✦";
  if (d.includes("sales") || d.includes("leas")) return "◉";
  if (d.includes("data") || d.includes("analyt")) return "⬢";
  if (d.includes("finance") || d.includes("revenue")) return "◆";
  if (d.includes("hr") || d.includes("people")) return "◎";
  return "⊕";
};

const STATUS_C = { Interview:"#0e9e8a", Review:"#2563eb", Offer:"#9333ea", Screening:"#d97706", New:"#6b7280" };
const STATUS_P = { Interview:"#00ffcc", Review:"#00aaff", Offer:"#ff44cc", Screening:"#ffcc00", New:"#cc88ff" };

const LI = (color) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={color} style={{flexShrink:0}}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// OPCO HUB
// ═══════════════════════════════════════════════════════════════════════════
function OpcoHub({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyStep, setApplyStep] = useState(0);
  const [form, setForm] = useState({ name:"", email:"", phone:"", role:"", linkedin:"", resume:"", consent:false });
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [adminView, setAdminView] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [live, sbJobs, sbApps] = await Promise.all([
        fetchLiveBoards("opco"),
        sbFetchJobs("opco"),
        sbFetchApplicants("opco"),
      ]);
      const liveCompanies = new Set(live.map(j => j.company));
      const base = sbJobs.filter(j => !liveCompanies.has(j.company));
      setJobs([...live, ...base]);
      if (sbApps.length > 0) setApplicants(sbApps);
      setLoading(false);
    };
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const allCompanies = [...new Set(jobs.map(j => j.company))];
  const companies = ["All", ...(q ? allCompanies.filter(c => c.toLowerCase().includes(q)) : allCompanies)];
  const filtered = jobs.filter(j => {
    const matchFilter = filter === "All" || j.company === filter;
    const matchSearch = !q || j.company.toLowerCase().includes(q) || j.title.toLowerCase().includes(q) || j.location.toLowerCase().includes(q) || j.dept.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const saveApp = async (data) => {
    await sbSaveApplicant("opco", data);
    const updated = await sbFetchApplicants("opco");
    setApplicants(updated.length > 0 ? updated : prev => [{ id: Date.now(), ...data, appliedAt: new Date().toISOString(), status: "New" }, ...prev]);
  };
  const updateStatus = async (id, status) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await sbUpdateStatus(id, status);
  };
  const analyze = async () => {
    if (!form.resume.trim()) return;
    setAnalyzing(true); setAiAnalysis("");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:700,
          messages:[{ role:"user", content:`Senior SFR recruiter. Analyze for "${selectedJob?.title}" at ${selectedJob?.company}.\nSTRENGTHS:\nGAPS:\nMATCH SCORE: XX/100\nResume: ${form.resume}` }]
        })
      });
      const d = await r.json(); setAiAnalysis(d.content?.[0]?.text || "Analysis complete.");
    } catch { setAiAnalysis("Could not connect. Please try again."); }
    setAnalyzing(false);
  };
  const submit = async () => {
    const m = aiAnalysis.match(/MATCH SCORE:\s*(\d+)/i);
    await saveApp({ name:form.name, email:form.email, phone:form.phone, currentRole:form.role, linkedin:form.linkedin, resume:form.resume, aiAnalysis, score: m ? parseInt(m[1]) : 72, jobTitle:selectedJob?.title, company:selectedJob?.company });
    setSubmitted(true);
  };
  const resetApply = () => { setSelectedJob(null); setApplyStep(0); setSubmitted(false); setAiAnalysis(""); setForm({ name:"", email:"", phone:"", role:"", linkedin:"", resume:"", consent:false }); };

  const inp = { width:"100%", padding:"10px 14px", borderRadius:6, background:"#fff", border:"1px solid #d1d5db", color:"#111827", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", transition:"border 0.15s,box-shadow 0.15s", boxSizing:"border-box" };
  const focusInp = (e) => { e.target.style.borderColor="#0d2e2a"; e.target.style.boxShadow="0 0 0 3px rgba(26,58,42,0.1)"; };
  const blurInp = (e) => { e.target.style.borderColor="#d1d5db"; e.target.style.boxShadow="none"; };

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes opcoShimmer{0%{left:-100%}65%,100%{left:150%}}
    *{box-sizing:border-box}
    input::placeholder,textarea::placeholder{color:#9ca3af;font-family:'DM Sans',sans-serif}
    .ojob{transition:all 0.18s ease;position:relative;overflow:hidden}
    .ojob::before{content:'';position:absolute;top:0;left:-100%;width:50%;height:100%;background:linear-gradient(90deg,transparent,rgba(14,158,138,0.06),rgba(94,232,212,0.04),transparent);animation:opcoShimmer 6s ease-in-out infinite;pointer-events:none;z-index:1}
    .ojob:hover{border-color:var(--cc)!important;box-shadow:0 4px 20px rgba(0,0,0,0.1),0 0 0 1px var(--cc)!important;transform:translateY(-1px)}
    .orow:hover{background:#f9fafb!important}
    .glass-card{background:rgba(255,255,255,0.72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.9);box-shadow:0 4px 24px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)}
  `;

  if (adminView) return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'DM Sans',sans-serif", color:"#111827" }}>
      <style>{STYLES}</style>
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"0 40px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", height:64, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:6, background:"#0d2e2a", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>🏘</div>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:700 }}>Founders & Friends <span style={{ color:"#9ca3af", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:400 }}>/ OpCo Admin</span></span>
          </div>
          <button onClick={()=>setAdminView(false)} style={{ padding:"8px 18px", borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>← Back to Jobs</button>
        </div>
      </div>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"32px 40px" }}>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, margin:"0 0 4px" }}>Applicant Pipeline</h1>
        <p style={{ color:"#6b7280", fontSize:15, margin:"0 0 28px" }}>Property management candidates across all OpCo roles</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:28 }}>
          {[["Total",applicants.length,"#0d2e2a"],["New",applicants.filter(a=>a.status==="New").length,"#374151"],["Interview",applicants.filter(a=>a.status==="Interview").length,"#1d4ed8"],["Offers",applicants.filter(a=>a.status==="Offer").length,"#7c3aed"]].map(([l,v,c])=>(
            <div key={l} style={{ background:"rgba(255,255,255,0.75)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.9)", borderRadius:10, padding:"20px 22px", borderTop:`3px solid ${c}`, boxShadow:"0 2px 12px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,1)" }}>
              <div style={{ fontSize:11, color:"#9ca3af", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>{l}</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:30, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background:"rgba(255,255,255,0.75)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.88)", borderRadius:10, overflow:"hidden", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ padding:"16px 22px", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:15, fontWeight:700 }}>All Applicants</span>
            <span style={{ fontSize:12, color:"#9ca3af" }}>Click row to expand</span>
          </div>
          {applicants.length === 0
            ? <div style={{ padding:"48px", textAlign:"center", color:"#9ca3af", fontSize:14 }}>No applications yet.</div>
            : applicants.map((c) => (
              <div key={c.id}>
                <div className="orow" onClick={()=>setExpandedId(expandedId===c.id?null:c.id)}
                  style={{ padding:"14px 22px", borderBottom:"1px solid #f3f4f6", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", background:expandedId===c.id?"#f9fafb":"#fff", transition:"background 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:"50%", background:`${STATUS_C[c.status]||"#6b7280"}18`, border:`1.5px solid ${STATUS_C[c.status]||"#6b7280"}60`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:STATUS_C[c.status]||"#6b7280" }}>
                      {c.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}
                    </div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#111827" }}>{c.name}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>{c.jobTitle} · {c.email}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:c.score>=85?"#0e9e8a":c.score>=70?"#2563eb":"#d97706" }}>{c.score}</div>
                      <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em" }}>AI Score</div>
                    </div>
                    <select value={c.status} onChange={e=>{e.stopPropagation();updateStatus(c.id,e.target.value);}} onClick={e=>e.stopPropagation()}
                      style={{ fontSize:12, padding:"5px 10px", borderRadius:20, border:`1.5px solid ${STATUS_C[c.status]||"#6b7280"}60`, background:`${STATUS_C[c.status]||"#6b7280"}10`, color:STATUS_C[c.status]||"#6b7280", fontWeight:600, cursor:"pointer", outline:"none", fontFamily:"'DM Sans',sans-serif" }}>
                      {["New","Screening","Review","Interview","Offer"].map(s=><option key={s} value={s} style={{background:"#fff",color:"#111"}}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {expandedId===c.id && (
                  <div style={{ padding:"14px 22px 18px", background:"#f9fafb", borderBottom:"1px solid #f3f4f6" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:10 }}>
                      {[["Current Role",c.currentRole||"—"],["Phone",c.phone||"—"],["Applied",new Date(c.appliedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})]].map(([k,v])=>(
                        <div key={k} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 14px" }}>
                          <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:3 }}>{k}</div>
                          <div style={{ fontSize:13, color:"#374151", fontWeight:500 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {c.linkedin && (
                      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                        {LI("#0a66c2")}<a href={c.linkedin} target="_blank" rel="noreferrer" style={{ fontSize:13, color:"#0a66c2", textDecoration:"none" }}>{c.linkedin}</a>
                      </div>
                    )}
                    {c.aiAnalysis && (
                      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderLeft:"3px solid #2dd4bf", borderRadius:8, padding:"14px 16px" }}>
                        <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6, fontWeight:600 }}>AI Analysis</div>
                        <div style={{ fontSize:13, color:"#374151", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{c.aiAnalysis}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  if (selectedJob) return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'DM Sans',sans-serif", color:"#111827" }}>
      <style>{STYLES}</style>
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", padding:"0 40px" }}>
        <div style={{ maxWidth:780, margin:"0 auto", height:64, display:"flex", alignItems:"center" }}>
          <button onClick={resetApply} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:14, fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:6 }}>← Back to roles</button>
        </div>
      </div>
      <div style={{ maxWidth:780, margin:"0 auto", padding:"36px 40px 80px" }}>
        <div style={{ background:"rgba(255,255,255,0.72)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.88)", borderRadius:12, padding:"26px 30px", marginBottom:20, borderTop:`4px solid ${COMPANY_COLORS[selectedJob.company]||"#0e9e8a"}`, boxShadow:"0 4px 24px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)" }}>
          <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600, marginBottom:6 }}>{selectedJob.company}</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, margin:"0 0 12px" }}>{selectedJob.title}</h1>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[selectedJob.location, selectedJob.type, selectedJob.dept, selectedJob.salary].filter(Boolean).map(t=>(
              <span key={t} style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background: t===selectedJob.salary?"#d0faf5":"#f3f4f6", color: t===selectedJob.salary?"#0a8a78":"#374151", fontWeight: t===selectedJob.salary?600:400 }}>{t}</span>
            ))}
            {selectedJob.source==="greenhouse" && <span style={{ fontSize:11, padding:"3px 9px", borderRadius:20, background:"#d0faf5", color:"#0e9e8a", fontWeight:700 }}>● LIVE</span>}
          </div>
          {selectedJob.url && selectedJob.url !== "#" && (
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
              onClick={()=>sbTrackClick(selectedJob, "opco")}
              style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:18, padding:"10px 18px", borderRadius:8, background:"#0d2e2a", color:"#fff", fontSize:13, fontWeight:600, textDecoration:"none", fontFamily:"'DM Sans',sans-serif" }}>
              View original posting <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        {submitted ? (
          <div style={{ background:"rgba(255,255,255,0.72)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.88)", borderRadius:12, boxShadow:"0 4px 24px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)", padding:"48px", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, marginBottom:8 }}>Application Submitted</h2>
            <p style={{ color:"#6b7280", fontSize:14, marginBottom:20, lineHeight:1.6 }}>Thank you for applying to <strong>{selectedJob.title}</strong> at <strong>{selectedJob.company}</strong>.</p>
            <button onClick={resetApply} style={{ padding:"10px 24px", borderRadius:6, border:"none", background:"#0d2e2a", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer" }}>Browse More Roles</button>
          </div>
        ) : (
          <div style={{ background:"rgba(255,255,255,0.72)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.88)", borderRadius:12, boxShadow:"0 4px 24px rgba(0,0,0,0.06),inset 0 1px 0 rgba(255,255,255,1)", padding:"30px" }}>
            <div style={{ display:"flex", alignItems:"center", marginBottom:28 }}>
              {["Your Info","Resume","AI Review"].map((s,i)=>(
                <div key={s} style={{ display:"flex", alignItems:"center", flex:1 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                    <div style={{ width:28, height:28, borderRadius:"50%", background:applyStep>=i?"#0d2e2a":"#f3f4f6", border:`2px solid ${applyStep>=i?"#0d2e2a":"#d1d5db"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:applyStep>=i?"#fff":"#9ca3af", marginBottom:5 }}>{applyStep>i?"✓":i+1}</div>
                    <div style={{ fontSize:10, color:applyStep>=i?"#0d2e2a":"#9ca3af", fontWeight:applyStep===i?700:400, textTransform:"uppercase", letterSpacing:"0.06em" }}>{s}</div>
                  </div>
                  {i<2 && <div style={{ height:1, flex:1, background:applyStep>i?"#0d2e2a":"#e5e7eb", marginBottom:20 }} />}
                </div>
              ))}
            </div>
            {applyStep===0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  {[["Full Name","name","text","Jane Smith"],["Email","email","email","jane@email.com"]].map(([l,k,t,p])=>(
                    <div key={k}><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#374151", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.07em" }}>{l}</label><input type={t} placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp} onFocus={focusInp} onBlur={blurInp} /></div>
                  ))}
                </div>
                {[["Phone","phone","tel","(555) 000-0000"],["Current Role / Company","role","text","e.g. Property Manager at AIMCO"]].map(([l,k,t,p])=>(
                  <div key={k}><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#374151", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.07em" }}>{l}</label><input type={t} placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp} onFocus={focusInp} onBlur={blurInp} /></div>
                ))}
                <div>
                  <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, fontWeight:700, color:"#374151", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.07em" }}>{LI("#0a66c2")} LinkedIn <span style={{color:"#9ca3af",fontWeight:400,textTransform:"none",fontSize:12}}>(optional)</span></label>
                  <input type="url" placeholder="https://linkedin.com/in/yourname" value={form.linkedin} onChange={e=>setForm({...form,linkedin:e.target.value})} style={{...inp,borderColor:"#bfdbfe"}} onFocus={e=>{e.target.style.borderColor="#1d4ed8";e.target.style.boxShadow="0 0 0 3px rgba(29,78,216,0.08)";}} onBlur={e=>{e.target.style.borderColor="#bfdbfe";e.target.style.boxShadow="none";}} />
                </div>
                <button onClick={()=>setApplyStep(1)} style={{ marginTop:6, padding:"12px", borderRadius:6, border:"none", background:"#0d2e2a", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Continue →</button>
              </div>
            )}
            {applyStep===1 && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#374151", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.07em" }}>Resume or Professional Summary</label>
                  <textarea rows={9} placeholder="Paste your resume, LinkedIn summary, or professional background here..." value={form.resume} onChange={e=>setForm({...form,resume:e.target.value})} style={{...inp,resize:"vertical",lineHeight:1.6}} onFocus={focusInp} onBlur={blurInp} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <button onClick={()=>setApplyStep(0)} style={{ padding:"11px", borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>← Back</button>
                  <button onClick={()=>{setApplyStep(2);analyze();}} style={{ padding:"11px", borderRadius:6, border:"none", background:"#0d2e2a", color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Run AI Review →</button>
                </div>
              </div>
            )}
            {applyStep===2 && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div style={{ background:"rgba(240,252,250,0.8)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", border:"1px solid rgba(14,158,138,0.15)", borderLeft:"3px solid #0e9e8a", borderRadius:8, padding:"18px", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <div style={{ width:26, height:26, borderRadius:6, background:"#0d2e2a", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12 }}>✦</div>
                    <div><div style={{ fontSize:13, fontWeight:700 }}>AI Candidate Review</div><div style={{ fontSize:11, color:"#9ca3af" }}>Powered by Claude</div></div>
                  </div>
                  {analyzing ? (
                    <div style={{ display:"flex", alignItems:"center", gap:8, color:"#6b7280", fontSize:13 }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #d1d5db", borderTopColor:"#0d2e2a", animation:"spin 0.8s linear infinite" }} /> Reviewing your background...
                    </div>
                  ) : <div style={{ fontSize:13, lineHeight:1.8, color:"#374151", whiteSpace:"pre-wrap" }}>{aiAnalysis}</div>}
                </div>
                {!analyzing && aiAnalysis && (
                  <>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, cursor:"pointer" }} onClick={()=>setForm({...form,consent:!form.consent})}>
                      <div style={{ width:17, height:17, borderRadius:4, border:`2px solid ${form.consent?"#0d2e2a":"#d1d5db"}`, background:form.consent?"#0d2e2a":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                        {form.consent && <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize:12, color:"#6b7280", lineHeight:1.6 }}>I consent to Founders & Friends storing my application data for recruiting purposes. <span style={{ color:"#0d2e2a", fontWeight:600 }}>Privacy Policy</span></div>
                    </div>
                    <button onClick={submit} disabled={!form.consent} style={{ padding:"12px", borderRadius:6, border:"none", background:form.consent?"#0e9e8a":"#f3f4f6", color:form.consent?"#fff":"#9ca3af", fontSize:14, fontWeight:600, cursor:form.consent?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}>
                      {form.consent ? "Submit Application" : "Please accept consent to continue"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f9fafb", fontFamily:"'DM Sans',sans-serif", color:"#111827" }}>
      <style>{STYLES}</style>
      <div style={{ background:"#fff", borderBottom:"1px solid #e5e7eb", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 40px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:13, marginRight:4, padding:0 }}>←</button>
            <div style={{ width:32, height:32, borderRadius:6, background:"#0d2e2a", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>🏘</div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, lineHeight:1 }}>Founders & Friends</div>
              <div style={{ fontSize:10, color:"#9ca3af", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:2 }}>OpCo Hub</div>
            </div>
          </div>
          <button onClick={()=>setAdminView(true)} style={{ padding:"8px 18px", borderRadius:6, border:"1px solid #d1d5db", background:"#fff", color:"#374151", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Admin →</button>
        </div>
      </div>
      <div style={{ background:"linear-gradient(135deg,#0d2e2a,#051e1c)", padding:"56px 40px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ fontSize:11, letterSpacing:"0.2em", textTransform:"uppercase", color:"#0e9e8a", marginBottom:12, fontWeight:600 }}>Property Management Careers</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(28px,4vw,52px)", fontWeight:700, margin:"0 0 14px", lineHeight:1.15, color:"#fff" }}>Build a Career in<br />Single-Family Rental.</h1>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:16, maxWidth:500, lineHeight:1.75, margin:"0 0 28px" }}>Roles across the nation's leading SFR operators — leasing, maintenance, asset management, and leadership.</p>
          <div style={{ position:"relative", maxWidth:440, marginBottom:16 }}>
            <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:"rgba(255,255,255,0.4)", fontSize:15, pointerEvents:"none" }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, role, or location…"
              style={{ width:"100%", padding:"11px 16px 11px 40px", borderRadius:25, border:"1px solid rgba(255,255,255,0.25)", background:"rgba(255,255,255,0.08)", color:"#fff", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box" }}
              onFocus={e=>{e.target.style.borderColor="#5ee8d4";e.target.style.background="rgba(255,255,255,0.12)";}}
              onBlur={e=>{e.target.style.borderColor="rgba(255,255,255,0.25)";e.target.style.background="rgba(255,255,255,0.08)";}} />
            {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", fontSize:16 }}>×</button>}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", maxHeight:96, overflowY:"auto", paddingRight:4 }}>
            {companies.map(c=>(
              <button key={c} onClick={()=>setFilter(c)} style={{ padding:"7px 18px", borderRadius:25, border:`1px solid ${filter===c?"transparent":"rgba(255,255,255,0.2)"}`, background:filter===c?"#fff":"transparent", color:filter===c?"#0d2e2a":"rgba(255,255,255,0.8)", fontSize:13, cursor:"pointer", fontWeight:filter===c?700:400, transition:"all 0.2s", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 40px" }}>
        {loading
          ? <div style={{ padding:"60px", textAlign:"center", color:"#9ca3af", fontSize:14 }}>Loading live job listings…</div>
          : filtered.length === 0
          ? <div style={{ padding:"60px 40px", textAlign:"center" }}>
              <div style={{ fontSize:32, marginBottom:12, opacity:0.4 }}>🏘</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, color:"#374151", marginBottom:6 }}>No open roles right now</div>
              <div style={{ fontSize:14, color:"#9ca3af", maxWidth:380, margin:"0 auto", lineHeight:1.6 }}>{search || filter!=="All" ? "Try clearing your search or filter." : "We're syncing live roles from operator career pages. Check back soon."}</div>
            </div>
          : <div style={{ display:"grid", gap:10 }}>
              {filtered.map((job,i)=>{
                const cc = COMPANY_COLORS[job.company]||"#0d2e2a";
                return (
                  <div key={job.id} className="ojob" onClick={()=>setSelectedJob(job)}
                    style={{ "--cc":cc, background:"#fff", border:"1px solid #e5e7eb", borderLeft:`4px solid ${cc}`, borderRadius:10, padding:"18px 22px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", transition:"all 0.15s", animation:`fadeUp 0.4s ease ${i*0.05}s both` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:42, height:42, borderRadius:10, background:`${cc}12`, border:`1px solid ${cc}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:cc, flexShrink:0 }}>{DEPT_ICON(job.dept)}</div>
                      <div>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, marginBottom:3 }}>{job.title}</div>
                        <div style={{ display:"flex", gap:8, fontSize:13, color:"#6b7280", alignItems:"center" }}>
                          <span style={{ fontWeight:600, color:cc }}>{job.company}</span>
                          <span style={{ color:"#d1d5db" }}>·</span><span>{job.location}</span>
                          <span style={{ color:"#d1d5db" }}>·</span><span>{job.dept}</span>
                          {(job.source==="greenhouse"||job.source==="lever") && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:"#d0faf5", color:"#0e9e8a", fontWeight:700 }}>● LIVE</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
                      <div style={{ textAlign:"right" }}>
                        {job.salary && <div style={{ fontSize:13, fontWeight:700, color:"#0e9e8a" }}>{job.salary}</div>}
                        <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{job.type} · {job.posted}</div>
                      </div>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:`${cc}12`, border:`1px solid ${cc}30`, display:"flex", alignItems:"center", justifyContent:"center", color:cc }}>→</div>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPTECH HUB
// ═══════════════════════════════════════════════════════════════════════════
function ProptechHub({ onBack }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [applyStep, setApplyStep] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", role:"", linkedin:"", resume:"" });
  const [mousePos, setMousePos] = useState({ x:0, y:0 });
  const [applicants, setApplicants] = useState([]);
  const [adminView, setAdminView] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const h = (e) => setMousePos({ x:e.clientX, y:e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [live, sbJobs, sbApps] = await Promise.all([
        fetchLiveBoards("proptech"),
        sbFetchJobs("proptech"),
        sbFetchApplicants("proptech"),
      ]);
      const liveCompanies = new Set(live.map(j => j.company));
      const base = sbJobs.filter(j => !liveCompanies.has(j.company));
      setJobs([...live, ...base]);
      if (sbApps.length > 0) setApplicants(sbApps);
      setLoading(false);
    };
    load();
  }, []);

  const q = search.trim().toLowerCase();
  const allCompanies = [...new Set(jobs.map(j => j.company))];
  const companies = ["All", ...(q ? allCompanies.filter(c => c.toLowerCase().includes(q)) : allCompanies)];
  const filtered = jobs.filter(j => {
    const matchFilter = filter === "All" || j.company === filter;
    const matchSearch = !q || j.company.toLowerCase().includes(q) || j.title.toLowerCase().includes(q) || j.location.toLowerCase().includes(q) || j.dept.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
  const deptColors = { Engineering:"#00ccff", Product:"#cc44ff", Sales:"#ff4488", Data:"#00ffaa" };

  const saveApp = async (data) => {
    await sbSaveApplicant("proptech", data);
    const updated = await sbFetchApplicants("proptech");
    setApplicants(updated.length > 0 ? updated : prev => [{ id: Date.now(), ...data, appliedAt: new Date().toISOString(), status: "New" }, ...prev]);
  };
  const updateStatus = async (id, status) => {
    setApplicants(prev => prev.map(a => a.id===id?{...a,status}:a));
    await sbUpdateStatus(id, status);
  };
  const analyze = async () => {
    if (!form.resume.trim()) return;
    setAnalyzing(true); setAiAnalysis("");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:700,
          messages:[{ role:"user", content:`Proptech recruiter. Analyze for "${selectedJob?.title}" at ${selectedJob?.company}.\nSTRENGTHS:\nGAPS:\nMATCH SCORE: XX/100\n${form.linkedin?`LinkedIn: ${form.linkedin}. `:""}Resume: ${form.resume}` }]
        })
      });
      const d = await r.json(); setAiAnalysis(d.content?.[0]?.text || "Analysis complete.");
    } catch { setAiAnalysis("Could not connect. Please try again."); }
    setAnalyzing(false);
  };
  const submit = async () => {
    const m = aiAnalysis.match(/MATCH SCORE:\s*(\d+)/i);
    await saveApp({ name:form.name, email:form.email, currentRole:form.role, linkedin:form.linkedin, resume:form.resume, aiAnalysis, score:m?parseInt(m[1]):72, jobTitle:selectedJob?.title, company:selectedJob?.company });
    setSubmitted(true);
  };
  const resetApply = () => { setSelectedJob(null); setApplyStep(0); setSubmitted(false); setAiAnalysis(""); setConsent(false); setForm({name:"",email:"",role:"",linkedin:"",resume:""}); };

  const glass = { background:"rgba(8,3,22,0.45)", backdropFilter:"blur(32px)", WebkitBackdropFilter:"blur(32px)", border:"1px solid rgba(180,100,255,0.22)", borderRadius:"16px", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.06),inset 0 -1px 0 rgba(0,0,0,0.3)" };
  const shimmer = { ...glass, boxShadow:"0 0 50px rgba(120,0,255,0.18),0 8px 40px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.08),inset 0 -1px 0 rgba(0,0,0,0.3)" };
  const inp = { width:"100%", padding:"12px 16px", borderRadius:10, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(180,100,255,0.22)", color:"#f0f4ff", fontSize:16, outline:"none", boxSizing:"border-box", transition:"border 0.2s,box-shadow 0.2s", fontFamily:"'DM Sans',sans-serif" };

  const PSTYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=DM+Sans:wght@400;500;600;700&display=swap');
    @keyframes titleShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
    @keyframes orbPulse{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.25);opacity:.65}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes cardShimmer{0%{left:-110%}65%,100%{left:160%}}
    @keyframes fastShimmer{0%{left:-110%}to{left:160%}}
    @keyframes psycheFloat{0%,100%{transform:translateY(0) rotate(0deg);opacity:.55}33%{transform:translateY(-28px) rotate(120deg);opacity:.85}66%{transform:translateY(18px) rotate(240deg);opacity:.45}}
    @keyframes grainDrift{0%{transform:translate(0,0)}100%{transform:translate(72px,72px)}}
    @keyframes bgBreath{0%,100%{opacity:1}50%{opacity:0.7}}
    *{box-sizing:border-box}
    input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.28);font-family:'DM Sans',sans-serif}
    .sc{position:relative;overflow:hidden}
    .sc::before{content:'';position:absolute;top:0;left:-110%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(180,120,255,0.09),rgba(100,220,255,0.05),rgba(255,255,255,0.04),transparent);animation:cardShimmer 5s ease-in-out infinite;pointer-events:none;z-index:2;border-radius:inherit}
    .sc:hover::before{animation:fastShimmer 0.55s ease forwards}
    .pjob{transition:all 0.25s cubic-bezier(0.34,1.2,0.64,1);cursor:pointer}
    .pjob:hover{background:rgba(120,40,255,0.14)!important;border-color:rgba(180,100,255,0.45)!important;transform:translateX(5px);box-shadow:0 0 30px rgba(120,0,255,0.12)!important}
  `;

  const BG = (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
      {/* Deep layered orbs */}
      <div style={{ position:"absolute", top:"5%", left:"10%", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(160,0,255,0.14) 0%,transparent 65%)", animation:"orbPulse 8s ease-in-out infinite" }} />
      <div style={{ position:"absolute", top:"30%", right:"5%", width:580, height:580, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,180,255,0.09) 0%,transparent 65%)", animation:"orbPulse 11s ease-in-out infinite 2s" }} />
      <div style={{ position:"absolute", bottom:"10%", left:"20%", width:420, height:420, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,0,140,0.08) 0%,transparent 65%)", animation:"orbPulse 9s ease-in-out infinite 4s" }} />
      <div style={{ position:"absolute", top:"50%", left:"50%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,rgba(100,0,255,0.06) 0%,transparent 65%)", animation:"orbPulse 13s ease-in-out infinite 1s", transform:"translate(-50%,-50%)" }} />
      {/* Floating particles */}
      {[...Array(6)].map((_,i)=>(
        <div key={i} style={{ position:"absolute", width:3, height:3, borderRadius:"50%", background:["#ff00cc","#00ffcc","#cc00ff","#ff6600","#00ccff","#ffcc00"][i], left:`${15+i*14}%`, top:`${20+(i%3)*25}%`, boxShadow:`0 0 10px ${["#ff00cc","#00ffcc","#cc00ff","#ff6600","#00ccff","#ffcc00"][i]}`, animation:`psycheFloat ${7+i*1.5}s ease-in-out infinite ${i*0.8}s` }} />
      ))}
      {/* Grain texture */}
      <div style={{ position:"absolute", inset:"-50%", width:"200%", height:"200%", opacity:0.028,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize:"256px 256px", animation:"grainDrift 5s steps(4) infinite" }} />
      {/* Full-screen shimmer sweep — slow idle */}
      <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
        <div style={{ position:"absolute", top:0, left:"-60%", width:"40%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(180,100,255,0.03),rgba(100,200,255,0.025),transparent)",
          animation:"cardShimmer 12s ease-in-out infinite 1s" }} />
      </div>
      {/* Mouse-following glow */}
      <div style={{ position:"fixed", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle,rgba(140,40,255,0.07) 0%,rgba(0,180,255,0.04) 40%,transparent 65%)", left:mousePos.x-350, top:mousePos.y-350, transition:"left 0.35s ease,top 0.35s ease", pointerEvents:"none" }} />
    </div>
  );

  if (adminView) return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 20% 20%,#0d0020 0%,#000510 40%,#040010 70%,#000 100%)", fontFamily:"'DM Sans',sans-serif", color:"#f0f4ff", position:"relative" }}>
      <style>{PSTYLES}</style>{BG}
      <div style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"32px 24px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:36 }}>
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, letterSpacing:"0.3em", color:"#cc44ff", marginBottom:8, fontWeight:700 }}>◈ COMMAND CENTER</div>
            <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:28, fontWeight:900, margin:0, background:"linear-gradient(90deg,#fff,#cc88ff,#00ddff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>PROPTECH PIPELINE</h1>
          </div>
          <button onClick={()=>setAdminView(false)} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid rgba(180,80,255,0.3)", background:"rgba(180,80,255,0.1)", color:"rgba(255,255,255,0.72)", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>← BACK</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
          {[["TOTAL",applicants.length,"#cc44ff"],["NEW",applicants.filter(a=>a.status==="New").length,"#aa44ff"],["INTERVIEW",applicants.filter(a=>a.status==="Interview").length,"#00ccff"],["OFFERS",applicants.filter(a=>a.status==="Offer").length,"#ff44cc"]].map(([l,v,c])=>(
            <div key={l} className="sc" style={{ ...shimmer, padding:"18px 20px", position:"relative", overflow:"hidden", borderRadius:12 }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"rgba(120,210,255,0.5)", marginBottom:8, letterSpacing:"0.15em" }}>{l}</div>
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:28, fontWeight:900, color:c, textShadow:`0 0 20px ${c}60` }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="sc" style={{ ...shimmer, overflow:"hidden", position:"relative", borderRadius:16 }}>
          <div style={{ padding:"18px 22px", borderBottom:"1px solid rgba(180,80,255,0.1)" }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:700 }}>All Applicants</span>
          </div>
          {applicants.length===0
            ? <div style={{ padding:"44px", textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:13 }}>No applications yet.</div>
            : applicants.map(c=>(
              <div key={c.id}>
                <div onClick={()=>setExpandedId(expandedId===c.id?null:c.id)}
                  style={{ padding:"14px 22px", borderBottom:"1px solid rgba(180,80,255,0.07)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", background:expandedId===c.id?"rgba(140,0,255,0.08)":"transparent", transition:"background 0.2s" }}
                  onMouseEnter={e=>{if(expandedId!==c.id)e.currentTarget.style.background="rgba(140,0,255,0.05)";}}
                  onMouseLeave={e=>{if(expandedId!==c.id)e.currentTarget.style.background="transparent";}}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:`${STATUS_P[c.status]||"#cc44ff"}18`, border:`1px solid ${STATUS_P[c.status]||"#cc44ff"}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, color:STATUS_P[c.status]||"#cc44ff", fontFamily:"'DM Sans',sans-serif" }}>
                      {c.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700 }}>{c.name}</div>
                      <div style={{ fontSize:11, color:"rgba(200,230,255,0.65)" }}>{c.jobTitle} · {c.company}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ fontFamily:"'Orbitron',monospace", fontSize:17, fontWeight:900, color:c.score>=90?"#00ffaa":c.score>=80?"#00ccff":"#ffcc00" }}>{c.score}</div>
                    <select value={c.status} onChange={e=>{e.stopPropagation();updateStatus(c.id,e.target.value);}} onClick={e=>e.stopPropagation()}
                      style={{ fontSize:10, padding:"4px 10px", borderRadius:20, background:`${STATUS_P[c.status]||"#cc44ff"}18`, border:`1px solid ${STATUS_P[c.status]||"#cc44ff"}40`, color:STATUS_P[c.status]||"#cc44ff", fontWeight:700, cursor:"pointer", outline:"none", fontFamily:"'DM Sans',sans-serif" }}>
                      {["New","Screening","Review","Interview","Offer"].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {expandedId===c.id && c.aiAnalysis && (
                  <div style={{ padding:"10px 22px 14px", borderBottom:"1px solid rgba(180,80,255,0.07)" }}>
                    <div style={{ ...glass, padding:"12px 14px", borderColor:"rgba(160,60,255,0.3)", boxShadow:"0 0 20px rgba(120,0,255,0.1),inset 0 1px 0 rgba(255,255,255,0.06)" }}>
                      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"rgba(120,210,255,0.6)", marginBottom:6, letterSpacing:"0.15em" }}>✦ AI ANALYSIS</div>
                      <div style={{ fontSize:12, color:"rgba(180,220,255,0.8)", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{c.aiAnalysis}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"radial-gradient(ellipse at 20% 20%,#0d0020 0%,#000510 40%,#040010 70%,#000 100%)", fontFamily:"'DM Sans',sans-serif", color:"#f0f4ff", position:"relative", overflow:"hidden" }}>
      <style>{PSTYLES}</style>{BG}
      <div style={{ position:"relative", zIndex:1, maxWidth:1100, margin:"0 auto", padding:"0 24px 80px" }}>
        <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"28px 0 36px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={onBack} style={{ background:"none", border:"none", color:"rgba(120,210,255,0.5)", cursor:"pointer", fontSize:13, marginRight:4 }}>←</button>
            <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#9900ff,#00ccff,#ff0099)", backgroundSize:"300% 300%", animation:"titleShimmer 4s ease infinite", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:"0 0 20px rgba(150,0,255,0.5)" }}>⚡</div>
            <div>
              <div style={{ fontFamily:"'Orbitron',monospace", fontSize:15, fontWeight:900, letterSpacing:"0.08em", background:"linear-gradient(90deg,#cc44ff,#00ccff,#ff44cc,#cc44ff)", backgroundSize:"300% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"titleShimmer 5s linear infinite" }}>FOUNDERS</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:600, letterSpacing:"0.25em", color:"rgba(120,210,255,0.7)", marginTop:-2 }}>& FRIENDS · PROPTECH</div>
            </div>
          </div>
          <button onClick={()=>setAdminView(true)} style={{ padding:"9px 20px", borderRadius:10, border:"1px solid rgba(180,80,255,0.3)", background:"rgba(180,80,255,0.1)", color:"rgba(200,230,255,0.75)", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.08em" }}>⚡ ADMIN</button>
        </nav>

        {!selectedJob ? (
          <>
            <div style={{ textAlign:"center", marginBottom:52 }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, letterSpacing:"0.4em", textTransform:"uppercase", marginBottom:22, fontWeight:600, background:"linear-gradient(90deg,#ff44cc,#cc44ff,#44ccff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>◈ &nbsp; PROPTECH CAREERS &nbsp; ◈</div>
              <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:"clamp(28px,4vw,60px)", fontWeight:900, margin:"0 0 6px", background:"linear-gradient(90deg,#fff,#cc88ff,#00ddff,#ff44cc,#fff)", backgroundSize:"400% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"titleShimmer 6s linear infinite" }}>BE HERE</h1>
              <h1 style={{ fontFamily:"'Orbitron',monospace", fontSize:"clamp(28px,4vw,60px)", fontWeight:900, margin:"0 0 20px", background:"linear-gradient(90deg,#ff00cc,#9900ff,#00ffcc,#ff6600,#ff00cc)", backgroundSize:"400% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"titleShimmer 4s linear infinite reverse", filter:"drop-shadow(0 0 30px rgba(200,0,255,0.4))" }}>NOW.</h1>
              <p style={{ color:"rgba(255,255,255,0.75)", fontSize:16, maxWidth:440, margin:"0 auto 28px", lineHeight:1.75 }}>Join the companies building technology that powers the SFR industry.</p>
              <div style={{ position:"relative", maxWidth:420, margin:"0 auto 16px" }}>
                <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:"rgba(0,220,255,0.5)", fontSize:15, pointerEvents:"none" }}>⌕</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, role, or location…"
                  style={{ width:"100%", padding:"11px 16px 11px 40px", borderRadius:25, border:"1px solid rgba(180,100,255,0.3)", background:"rgba(140,60,255,0.08)", color:"#f0f4ff", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box", textAlign:"left" }}
                  onFocus={e=>{e.target.style.borderColor="rgba(0,220,255,0.6)";e.target.style.boxShadow="0 0 16px rgba(0,180,255,0.2)";}}
                  onBlur={e=>{e.target.style.borderColor="rgba(180,100,255,0.3)";e.target.style.boxShadow="none";}} />
                {search && <button onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"rgba(200,160,255,0.6)", cursor:"pointer", fontSize:16 }}>×</button>}
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", maxHeight:104, overflowY:"auto", padding:"0 4px" }}>
                {companies.map(c=>(
                  <button key={c} onClick={()=>setFilter(c)} style={{ padding:"7px 16px", borderRadius:20, border:"none", fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:700, letterSpacing:"0.1em", cursor:"pointer", background:filter===c?"linear-gradient(135deg,rgba(140,0,255,0.6),rgba(0,180,255,0.4))":"rgba(180,80,255,0.08)", color:filter===c?"#fff":"rgba(200,230,255,0.6)", boxShadow:filter===c?"0 0 14px rgba(140,0,255,0.25)":"none", transition:"all 0.2s", whiteSpace:"nowrap" }}>{c.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gap:10 }}>
              {loading ? (
                <div style={{ padding:"60px", textAlign:"center", color:"rgba(200,230,255,0.5)", fontSize:14 }}>Loading live job listings…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:"60px 40px", textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:12, opacity:0.5 }}>⚡</div>
                  <div style={{ fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:900, color:"#cc88ff", marginBottom:8 }}>NO OPEN ROLES RIGHT NOW</div>
                  <div style={{ fontSize:13, color:"rgba(200,230,255,0.6)", maxWidth:380, margin:"0 auto", lineHeight:1.6, fontFamily:"'DM Sans',sans-serif" }}>{search || filter!=="All" ? "Try clearing your search or filter." : "We're syncing live roles from proptech career pages. Check back soon."}</div>
                </div>
              ) : filtered.map((job,i)=>{
                const cc = COMPANY_COLORS[job.company]||(deptColors[job.dept]||"#cc44ff");
                return (
                  <div key={job.id} className="sc pjob" onClick={()=>setSelectedJob(job)}
                    style={{ background:"rgba(10,5,30,0.55)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:`1px solid rgba(180,100,255,0.18)`, borderLeft:`3px solid ${cc}`, borderRadius:12, padding:"18px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", animation:`fadeUp 0.4s ease ${i*0.06}s both`, position:"relative", overflow:"hidden", boxShadow:"0 0 30px rgba(120,0,255,0.1),inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16, position:"relative", zIndex:2 }}>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${cc}18`, border:`1px solid ${cc}40`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:cc, flexShrink:0 }}>{DEPT_ICON(job.dept)}</div>
                      <div>
                        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:15, fontWeight:800, marginBottom:3, color:"#ffffff" }}>{job.title}</div>
                        <div style={{ display:"flex", gap:8, fontSize:11, color:"rgba(180,220,255,0.65)" }}>
                          <span style={{ color:cc, fontWeight:600 }}>{job.company}</span><span style={{ opacity:.4 }}>·</span>
                          <span>{job.location}</span><span style={{ opacity:.4 }}>·</span><span>{job.dept}</span>
                          {(job.source==="greenhouse"||job.source==="lever") && <span style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:"rgba(0,255,170,0.15)", color:"#00ffaa", fontWeight:700, letterSpacing:"0.05em" }}>● LIVE</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, position:"relative", zIndex:2 }}>
                      <div style={{ textAlign:"right" }}>
                        {job.salary && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, background:"linear-gradient(90deg,#00ffaa,#00ccff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{job.salary}</div>}
                        <div style={{ fontSize:10, color:"rgba(200,230,255,0.6)", marginTop:2 }}>{job.type} · {job.posted}</div>
                      </div>
                      <div style={{ width:30, height:30, borderRadius:"50%", background:"rgba(124,58,237,0.2)", border:"1px solid rgba(124,58,237,0.4)", display:"flex", alignItems:"center", justifyContent:"center", color:"#cc88ff" }}>→</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ maxWidth:660, margin:"0 auto" }}>
            <button onClick={resetApply} style={{ background:"none", border:"none", color:"rgba(120,210,255,0.5)", cursor:"pointer", fontSize:12, marginBottom:24, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.06em" }}>← BACK TO ROLES</button>
            <div className="sc" style={{ ...shimmer, padding:"36px", position:"relative", overflow:"hidden", boxShadow:"0 0 60px rgba(120,0,255,0.2),0 12px 50px rgba(0,0,0,0.65),inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.3)" }}>
              <div style={{ marginBottom:28, paddingBottom:22, borderBottom:"1px solid rgba(180,80,255,0.12)" }}>
                <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, letterSpacing:"0.3em", color:"#cc44ff", marginBottom:8, fontWeight:700 }}>◈ APPLYING FOR</div>
                <h2 style={{ fontFamily:"'Orbitron',monospace", fontSize:20, fontWeight:900, margin:"0 0 10px", background:"linear-gradient(90deg,#fff,#cc88ff,#00ddff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{selectedJob.title}</h2>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[selectedJob.company,selectedJob.location,selectedJob.type,selectedJob.salary].filter(Boolean).map(t=>(
                    <span key={t} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:"rgba(180,80,255,0.1)", border:"1px solid rgba(180,80,255,0.2)", color:"rgba(255,255,255,0.72)" }}>{t}</span>
                  ))}
                </div>
                {selectedJob.url && selectedJob.url !== "#" && (
                  <a href={selectedJob.url} target="_blank" rel="noopener noreferrer"
                    onClick={()=>sbTrackClick(selectedJob, "proptech")}
                    style={{ display:"inline-flex", alignItems:"center", gap:7, marginTop:16, padding:"10px 18px", borderRadius:10, background:"linear-gradient(135deg,#9900ff,#00ccff)", color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textDecoration:"none", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 0 20px rgba(140,0,255,0.35)" }}>
                    VIEW ORIGINAL POSTING <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
              {submitted ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:44, marginBottom:12 }}>🎉</div>
                  <h3 style={{ fontFamily:"'Orbitron',monospace", fontSize:16, fontWeight:900, marginBottom:8, background:"linear-gradient(90deg,#00ffcc,#cc44ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>APPLICATION TRANSMITTED</h3>
                  <p style={{ color:"rgba(255,255,255,0.6)", fontSize:13, marginBottom:18 }}>Signal received for <strong style={{color:"#cc88ff"}}>{selectedJob.title}</strong>.</p>
                  <button onClick={resetApply} style={{ padding:"10px 22px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#9900ff,#00ccff)", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.08em" }}>BROWSE MORE →</button>
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", marginBottom:28 }}>
                    {["INFO","RESUME","AI SCREEN"].map((s,i)=>(
                      <div key={s} style={{ flex:1, display:"flex", alignItems:"center" }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:applyStep>=i?"linear-gradient(135deg,#9900ff,#00ccff)":"rgba(180,80,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900, fontFamily:"'DM Sans',sans-serif", marginBottom:4, boxShadow:applyStep>=i?"0 0 12px rgba(140,0,255,0.4)":"none" }}>{applyStep>i?"✓":i+1}</div>
                          <div style={{ fontSize:10, color:applyStep>=i?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.3)", fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>{s}</div>
                        </div>
                        {i<2 && <div style={{ height:1, flex:1, background:applyStep>i?"linear-gradient(90deg,rgba(140,0,255,0.6),rgba(0,200,255,0.4))":"rgba(180,80,255,0.1)", marginBottom:18 }} />}
                      </div>
                    ))}
                  </div>
                  {applyStep===0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      {[["FULL NAME","name","text","Jane Smith"],["EMAIL","email","email","jane@example.com"],["CURRENT ROLE","role","text","e.g. PM at Lessen"]].map(([l,k,t,p])=>(
                        <div key={k}>
                          <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"rgba(120,210,255,0.7)", display:"block", marginBottom:5, fontWeight:700, letterSpacing:"0.12em" }}>{l}</label>
                          <input type={t} placeholder={p} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} style={inp} onFocus={e=>{e.target.style.borderColor="rgba(180,80,255,0.6)";e.target.style.boxShadow="0 0 16px rgba(140,0,255,0.2)";}} onBlur={e=>{e.target.style.borderColor="rgba(180,100,255,0.2)";e.target.style.boxShadow="none";}} />
                        </div>
                      ))}
                      <div>
                        <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"rgba(0,200,255,0.6)", display:"flex", alignItems:"center", gap:5, marginBottom:5, fontWeight:700, letterSpacing:"0.12em" }}>{LI("#00ccff")} LINKEDIN <span style={{ color:"rgba(255,255,255,0.22)", fontWeight:400 }}>(OPTIONAL)</span></label>
                        <input type="url" placeholder="https://linkedin.com/in/yourname" value={form.linkedin} onChange={e=>setForm({...form,linkedin:e.target.value})} style={{...inp,background:"rgba(0,200,255,0.05)",borderColor:"rgba(0,200,255,0.2)"}} onFocus={e=>e.target.style.borderColor="rgba(0,200,255,0.6)"} onBlur={e=>e.target.style.borderColor="rgba(0,200,255,0.2)"} />
                      </div>
                      <button onClick={()=>setApplyStep(1)} style={{ marginTop:4, padding:"12px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#9900ff,#00ccff)", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.1em", boxShadow:"0 0 20px rgba(140,0,255,0.35)" }}>CONTINUE →</button>
                    </div>
                  )}
                  {applyStep===1 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      <div>
                        <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"rgba(120,210,255,0.7)", display:"block", marginBottom:5, fontWeight:700, letterSpacing:"0.12em" }}>RESUME / BACKGROUND</label>
                        <textarea rows={7} placeholder="Paste your resume or professional background..." value={form.resume} onChange={e=>setForm({...form,resume:e.target.value})} style={{...inp,resize:"vertical",lineHeight:1.7}} onFocus={e=>{e.target.style.borderColor="rgba(180,80,255,0.6)";e.target.style.boxShadow="0 0 16px rgba(140,0,255,0.2)";}} onBlur={e=>{e.target.style.borderColor="rgba(180,100,255,0.2)";e.target.style.boxShadow="none";}} />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                        <button onClick={()=>setApplyStep(0)} style={{ padding:"11px", borderRadius:10, border:"1px solid rgba(180,80,255,0.2)", background:"transparent", color:"rgba(255,255,255,0.72)", fontSize:10, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>← BACK</button>
                        <button onClick={()=>{setApplyStep(2);analyze();}} style={{ padding:"11px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#9900ff,#00ccff)", color:"#fff", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 0 18px rgba(140,0,255,0.3)" }}>RUN AI SCREEN ✦</button>
                      </div>
                    </div>
                  )}
                  {applyStep===2 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                      <div style={{ ...glass, padding:"18px", borderColor:"rgba(180,80,255,0.35)", boxShadow:"0 0 24px rgba(180,0,255,0.12),inset 0 1px 0 rgba(255,255,255,0.07)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                          <div style={{ width:26, height:26, borderRadius:8, background:"linear-gradient(135deg,#9900ff,#00ccff)", display:"flex", alignItems:"center", justifyContent:"center" }}>✦</div>
                          <div><div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700 }}>AI ANALYSIS</div><div style={{ fontSize:10, color:"rgba(200,230,255,0.6)" }}>Powered by Claude</div></div>
                        </div>
                        {analyzing
                          ? <div style={{ display:"flex", alignItems:"center", gap:8, color:"rgba(255,255,255,0.72)", fontSize:12 }}><div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid rgba(140,0,255,0.4)", borderTopColor:"#9900ff", animation:"spin 0.8s linear infinite" }} /> Scanning...</div>
                          : <div style={{ fontSize:12, lineHeight:1.8, color:"rgba(225,200,255,0.9)", whiteSpace:"pre-wrap" }}>{aiAnalysis}</div>
                        }
                      </div>
                      {!analyzing && aiAnalysis && (
                        <>
                          <div style={{ ...glass, padding:"12px 14px", borderColor:"rgba(255,200,80,0.2)", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:10, boxShadow:"inset 0 1px 0 rgba(255,220,100,0.06)" }} onClick={()=>setConsent(!consent)}>
                            <div style={{ width:17, height:17, borderRadius:4, border:`2px solid ${consent?"#9900ff":"rgba(180,80,255,0.3)"}`, background:consent?"linear-gradient(135deg,#9900ff,#00ccff)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                              {consent && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ fontSize:11, color:"rgba(200,220,255,0.75)", lineHeight:1.6 }}>I consent to Founders & Friends storing my application data. <span style={{ color:"#cc44ff" }}>Privacy Policy</span></div>
                          </div>
                          <button onClick={submit} disabled={!consent} style={{ padding:"12px", borderRadius:10, border:"none", background:consent?"linear-gradient(135deg,#009966,#00ffaa)":"rgba(255,255,255,0.05)", color:consent?"#fff":"rgba(255,255,255,0.3)", fontSize:11, fontWeight:700, cursor:consent?"pointer":"not-allowed", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.1em", boxShadow:consent?"0 0 20px rgba(0,200,120,0.3)":"none", transition:"all 0.3s" }}>
                            {consent?"TRANSMIT APPLICATION ✓":"CONSENT REQUIRED"}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT — Hub selector
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [hub, setHub] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredText, setHoveredText] = useState(null); // "heading" | "sub" | null
  const [hoveredCard, setHoveredCard] = useState(null); // "opco" | "proptech" | null

  useEffect(() => {
    const h = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  if (hub === "opco") return <OpcoHub onBack={()=>setHub(null)} />;
  if (hub === "proptech") return <ProptechHub onBack={()=>setHub(null)} />;

  // Dynamic shadow color blends toward whichever card is hovered
  const shadowLeft  = hoveredCard === "opco"     ? "rgba(14,158,138,0.2)"  : hoveredCard === "proptech" ? "rgba(14,158,138,0.04)" : "rgba(94,232,212,0.10)";
  const shadowRight = hoveredCard === "proptech" ? "rgba(160,80,255,0.28)"  : hoveredCard === "opco"     ? "rgba(160,80,255,0.05)" : "rgba(160,80,255,0.14)";

  return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes titleShimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes driftA{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.08)}66%{transform:translate(-20px,20px) scale(0.95)}}
        @keyframes driftB{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-50px,25px) scale(1.05)}66%{transform:translate(30px,-40px) scale(1.1)}}
        @keyframes driftC{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,30px)}}
        @keyframes grainScroll{0%{transform:translate(0,0)}100%{transform:translate(64px,64px)}}
        @keyframes shimmerSweep{0%{left:-100%}60%,100%{left:140%}}
        @keyframes shimmerSweepSlow{0%{left:-100%}70%,100%{left:140%}}
        @keyframes borderPulse{0%,100%{opacity:0.5}50%{opacity:1}}
        .hcard{transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.35s ease,border-color 0.35s ease;cursor:pointer;position:relative;overflow:hidden}
        .hcard::before{content:'';position:absolute;top:0;left:-100%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.055),rgba(255,255,255,0.03),transparent);animation:shimmerSweepSlow 5s ease-in-out infinite;pointer-events:none;z-index:2}
        .hcard-opco::before{background:linear-gradient(90deg,transparent,rgba(14,158,138,0.12),rgba(94,232,212,0.07),transparent);animation:shimmerSweepSlow 4.5s ease-in-out infinite}
        .hcard-proptech::before{background:linear-gradient(90deg,transparent,rgba(180,100,255,0.1),rgba(100,200,255,0.06),transparent);animation:shimmerSweepSlow 5.5s ease-in-out infinite 0.8s}
        .hcard-opco:hover{transform:translateY(-8px) scale(1.015);box-shadow:0 20px 60px rgba(14,158,138,0.22),0 0 80px rgba(14,158,138,0.1),inset 0 1px 0 rgba(94,232,212,0.15)!important;border-color:rgba(14,158,138,0.45)!important}
        .hcard-proptech:hover{transform:translateY(-8px) scale(1.015);box-shadow:0 20px 60px rgba(160,80,255,0.3),0 0 80px rgba(160,80,255,0.12),inset 0 1px 0 rgba(180,100,255,0.15)!important;border-color:rgba(180,100,255,0.5)!important}
        .hcard-opco:hover::before{animation:shimmerSweep 0.7s ease forwards}
        .hcard-proptech:hover::before{animation:shimmerSweep 0.7s ease forwards}
        .hover-heading{transition:all 0.25s ease;cursor:default}
        .hover-heading:hover{text-shadow:0 0 40px rgba(94,232,212,0.6),0 0 80px rgba(14,158,138,0.2);letter-spacing:-0.01em;color:#fff!important}
        .hover-sub{transition:all 0.25s ease;cursor:default}
        .hover-sub:hover{color:rgba(255,255,255,0.85)!important;text-shadow:0 0 20px rgba(94,232,212,0.3)}
        *{box-sizing:border-box}
      `}</style>

      {/* ── Dynamic background ── */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden" }}>

        {/* Slow-drifting ambient orbs */}
        <div style={{ position:"absolute", width:700, height:700, borderRadius:"50%", background:`radial-gradient(circle,${shadowLeft} 0%,transparent 65%)`, left:"5%", top:"10%", animation:"driftA 18s ease-in-out infinite", transition:"background 0.8s ease" }} />
        <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", background:`radial-gradient(circle,${shadowRight} 0%,transparent 65%)`, right:"5%", bottom:"5%", animation:"driftB 22s ease-in-out infinite", transition:"background 0.8s ease" }} />
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,0.015) 0%,transparent 65%)", left:"40%", top:"40%", animation:"driftC 14s ease-in-out infinite" }} />

        {/* Fine noise/grain texture overlay */}
        <div style={{ position:"absolute", inset:"-50%", width:"200%", height:"200%", opacity:0.022,
          backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize:"256px 256px", animation:"grainScroll 4s steps(4) infinite" }} />

        {/* Mouse-following glow */}
        <div style={{ position:"fixed", width:600, height:600, borderRadius:"50%",
          background:"radial-gradient(circle,rgba(14,158,138,0.05) 0%,rgba(160,80,255,0.04) 40%,transparent 65%)",
          left:mousePos.x-300, top:mousePos.y-300,
          transition:"left 0.25s ease,top 0.25s ease", pointerEvents:"none" }} />

        {/* Thin horizontal scan line */}
        <div style={{ position:"absolute", left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(14,158,138,0.06),rgba(160,80,255,0.06),transparent)", top:"50%", pointerEvents:"none" }} />
      </div>

      {/* ── Content ── */}
      <div style={{ position:"relative", zIndex:1, textAlign:"center", padding:"0 24px" }}>

        {/* Logo lockup */}
        <div style={{ animation:"fadeUp 0.5s ease", marginBottom:44 }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:12, fontWeight:900, letterSpacing:"0.15em",
            background:"linear-gradient(90deg,#86efac,#ffffff,#c084fc)", backgroundSize:"300% auto",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
            animation:"titleShimmer 5s linear infinite", marginBottom:6 }}>FOUNDERS & FRIENDS</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", letterSpacing:"0.12em", fontFamily:"'DM Sans',sans-serif" }}>SFR TALENT NETWORK</div>
        </div>

        {/* Main heading — hover interaction */}
        <h1
          className="hover-heading"
          onMouseEnter={()=>setHoveredText("heading")}
          onMouseLeave={()=>setHoveredText(null)}
          style={{ fontSize:"clamp(26px,3.5vw,46px)", fontWeight:700,
            color: hoveredText === "heading" ? "#fff" : "rgba(255,255,255,0.92)",
            margin:"0 0 14px", letterSpacing:"-0.03em",
            animation:"fadeUp 0.5s ease 0.1s both", fontFamily:"'DM Sans',sans-serif",
            textShadow: hoveredText === "heading" ? "0 0 40px rgba(14,158,138,0.45),0 0 80px rgba(14,158,138,0.15)" : "none",
            transition:"color 0.25s,text-shadow 0.25s,letter-spacing 0.25s" }}>
          Where are you building?
        </h1>

        {/* Subheading — hover interaction */}
        <p
          className="hover-sub"
          onMouseEnter={()=>setHoveredText("sub")}
          onMouseLeave={()=>setHoveredText(null)}
          style={{ color: hoveredText === "sub" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
            fontSize:15, marginBottom:48,
            animation:"fadeUp 0.5s ease 0.2s both", fontFamily:"'DM Sans',sans-serif",
            textShadow: hoveredText === "sub" ? "0 0 20px rgba(14,158,138,0.22)" : "none",
            transition:"color 0.25s,text-shadow 0.25s" }}>
          Choose your hub to explore live career opportunities.
        </p>

        {/* Hub cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:680, animation:"fadeUp 0.5s ease 0.3s both" }}>

          {/* OpCo */}
          <div className="hcard hcard-opco"
            onClick={()=>setHub("opco")}
            onMouseEnter={()=>setHoveredCard("opco")}
            onMouseLeave={()=>setHoveredCard(null)}
            style={{ background:"rgba(13,46,42,0.55)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
              border:"1px solid rgba(14,158,138,0.2)",
              borderRadius:16, padding:"32px 26px", textAlign:"left",
              boxShadow:"0 0 40px rgba(14,158,138,0.12),0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(94,232,212,0.08)" }}>
            <div style={{ fontSize:36, marginBottom:18 }}>🏘</div>
            <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#0e9e8a",
              marginBottom:8, fontFamily:"'DM Sans',sans-serif", fontWeight:600 }}>Property Management</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700,
              color:"#f0ede6", margin:"0 0 10px", lineHeight:1.2 }}>OpCo Hub</h2>
            <p style={{ color:"rgba(220,240,235,0.6)", fontSize:13, lineHeight:1.7,
              margin:"0 0 24px", fontFamily:"'DM Sans',sans-serif" }}>
              Careers across the nation's leading single-family rental operators.
            </p>
            <div style={{ fontSize:12, fontWeight:700, color:"#0e9e8a", fontFamily:"'DM Sans',sans-serif",
              borderTop:"1px solid rgba(14,158,138,0.15)", paddingTop:14,
              display:"flex", alignItems:"center", gap:6 }}>
              Explore Roles <span style={{ transition:"transform 0.2s", transform: hoveredCard==="opco"?"translateX(4px)":"translateX(0)", display:"inline-block" }}>→</span>
            </div>
          </div>

          {/* Proptech */}
          <div className="hcard hcard-proptech"
            onClick={()=>setHub("proptech")}
            onMouseEnter={()=>setHoveredCard("proptech")}
            onMouseLeave={()=>setHoveredCard(null)}
            style={{ background:"rgba(13,0,32,0.55)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
              border:"1px solid rgba(180,100,255,0.18)",
              borderRadius:16, padding:"32px 26px", textAlign:"left",
              boxShadow:"0 0 40px rgba(120,0,255,0.1),0 8px 32px rgba(0,0,0,0.5),inset 0 1px 0 rgba(180,100,255,0.08)" }}>
            <div style={{ fontSize:36, marginBottom:18 }}>⚡</div>
            <div style={{ fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:8,
              fontFamily:"'DM Sans',sans-serif", fontWeight:700,
              background:"linear-gradient(90deg,#cc44ff,#00ccff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Technology Vendors</div>
            <h2 style={{ fontFamily:"'Orbitron',monospace", fontSize:20, fontWeight:900, margin:"0 0 10px",
              lineHeight:1.2, background:"linear-gradient(90deg,#fff,#cc88ff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>PROPTECH HUB</h2>
            <p style={{ color:"rgba(200,180,255,0.65)", fontSize:13, lineHeight:1.7,
              margin:"0 0 24px", fontFamily:"'DM Sans',sans-serif" }}>
              Roles at the technology companies powering SFR at scale.
            </p>
            <div style={{ fontSize:10, fontWeight:700, fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.08em",
              borderTop:"1px solid rgba(180,80,255,0.12)", paddingTop:14,
              background:"linear-gradient(90deg,#cc44ff,#00ccff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              display:"flex", alignItems:"center", gap:6 }}>
              EXPLORE ROLES <span style={{ transition:"transform 0.2s", transform: hoveredCard==="proptech"?"translateX(4px)":"translateX(0)", display:"inline-block", background:"linear-gradient(90deg,#cc44ff,#00ccff)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>→</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
