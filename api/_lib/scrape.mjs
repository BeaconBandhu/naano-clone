/* Shared LinkedIn + X scrape → Marketplace-card evaluation.
 * Used by both the Vercel function (api/evaluate.mjs) and the local dev server
 * (server/serve.mjs) so behaviour is identical deployed vs local.
 *
 * LinkedIn: Apify REST — the same HarvestAPI actors the "Test Linkedin" tool uses
 *   (no Python, no browser). Needs an Apify token (env APIFY_TOKEN or per-request).
 *   Falls back to a bundled sample scrape for /in/aranyabandhu/ when no token.
 * X: fxtwitter public mirror — /<handle> for bio+audience, /status/<id> per post link.
 */
import SAMPLE from "./sample-linkedin.mjs";

const APIFY = "https://api.apify.com/v2/acts";
const PROFILE_ACTOR = "harvestapi~linkedin-profile-scraper";
const POSTS_ACTOR = "harvestapi~linkedin-profile-posts";
const PROFILE_MODE = "Profile details no email ($4 per 1k)";
const FX = "https://api.fxtwitter.com";

/* ------------------------------------------------------------------ utils */
export const liSlug = (u = "") => { const m = String(u).match(/\/in\/([^/?#]+)/i); return m ? decodeURIComponent(m[1]).toLowerCase() : null; };
export const xHandle = (u = "") => {
  const s = String(u).trim();
  if (/^@?[A-Za-z0-9_]{1,15}$/.test(s)) return s.replace(/^@/, "");
  const m = s.match(/(?:x\.com|twitter\.com)\/(?!(?:i|home|search|hashtag)\/)([A-Za-z0-9_]{1,15})/i);
  return m ? m[1] : null;
};
export const xPostId = (u = "") => {
  const s = String(u).trim();
  if (/^\d+$/.test(s)) return s;
  const m = s.match(/(?:x\.com|twitter\.com)\/[^/]+\/status(?:es)?\/(\d+)/i);
  return m ? m[1] : null;
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const nice = (n) => {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 >= 100 ? 1 : 0) + "K";
  return "" + n;
};
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const asDict = (v) => (v && typeof v === "object" ? v : {});
async function jget(url, opts = {}, ms = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { const r = await fetch(url, { signal: ac.signal, ...opts }); return r; }
  finally { clearTimeout(t); }
}

/* ---------------------------------------- presence score (port of scoring.py) */
export function computeScore(followers, connections, postLikes) {
  const W = { followers: 30, connections: 20, avg_likes: 30, engagement_rate: 20 };
  const T = { followers: 50000, connections: 500, avg_likes: 500, engagement_rate_pct: 5.0 };
  const f = followers || 0, c = connections || 0;
  const likes = (postLikes || []).filter((x) => typeof x === "number");
  const totalLikes = likes.reduce((a, b) => a + b, 0);
  const avgLikes = likes.length ? totalLikes / likes.length : 0;
  const eng = f ? (avgLikes / f) * 100 : 0;
  const logC = (w, v, t) => (v > 0 ? Math.min(w, (w * Math.log10(v + 1)) / Math.log10(t + 1)) : 0);
  const linC = (w, v, t) => (v > 0 ? Math.min(w, (w * v) / t) : 0);
  const r1 = (x) => Math.round(x * 10) / 10;
  const b = {
    followers: r1(logC(W.followers, f, T.followers)),
    connections: r1(linC(W.connections, c, T.connections)),
    avg_likes: r1(logC(W.avg_likes, avgLikes, T.avg_likes)),
    engagement_rate: r1(linC(W.engagement_rate, eng, T.engagement_rate_pct)),
  };
  const total = r1(b.followers + b.connections + b.avg_likes + b.engagement_rate);
  const grade = total >= 90 ? "A+" : total >= 80 ? "A" : total >= 70 ? "B" : total >= 60 ? "C" : total >= 50 ? "D" : "E";
  return {
    total_out_of_100: total, grade, breakdown_points: b,
    derived: { followers: f, connections: c, num_posts_counted: likes.length, total_likes: Math.round(totalLikes),
      avg_likes: Math.round(avgLikes * 10) / 10, engagement_rate_pct: Math.round(eng * 100) / 100 },
  };
}

/* -------------------------------------------------- LinkedIn via Apify REST */
async function apifyRun(actor, input, token) {
  const r = await jget(`${APIFY}/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  }, 55000);
  if (!r.ok) throw new Error(`Apify ${actor.split("~").pop()} → HTTP ${r.status}`);
  return r.json();
}

export async function scrapeLinkedIn(url, token) {
  const out = { ok: false };
  const slug = liSlug(url);
  if (token) {
    try {
      const profItems = await apifyRun(PROFILE_ACTOR, { urls: [url], profileScraperMode: PROFILE_MODE }, token);
      const p = Array.isArray(profItems) ? profItems[0] : null;
      if (!p) throw new Error("profile actor returned nothing (private / not found / blocked)");
      const connections = num(p.connectionsCount);
      const nm = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
      let posts = [];
      try {
        const postItems = await apifyRun(POSTS_ACTOR, { targetUrls: [url], maxPosts: 5 }, token);
        posts = (Array.isArray(postItems) ? postItems : []).map((it) => {
          const e = asDict(it.engagement), pa = asDict(it.postedAt);
          return {
            ts: pa.timestamp || 0, url: it.linkedinUrl || it.shareLinkedinUrl || null,
            text_preview: typeof it.content === "string" ? it.content : "",
            posted: pa.postedAgoShort || pa.date || null, type: it.type || "post",
            likes: num(e.likes ?? e.reactionsCount) || 0, comments: num(e.comments) || 0,
            reposts: num(e.shares ?? e.reposts),
          };
        }).sort((a, b) => b.ts - a.ts).slice(0, 5).map(({ ts, ...q }) => q);
      } catch (e) { out.posts_error = String(e.message || e); }
      const followers = num(p.followerCount ?? p.followersCount);
      const score = computeScore(followers, connections, posts.map((q) => q.likes));
      out.report = {
        profile: { url, name: nm ? (nm === nm.toUpperCase() ? nm.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()) : nm) : null,
          headline: p.headline || null, bio: p.about || null },
        metrics: { followers, connections, connections_display: connections >= 500 ? "500+" : String(connections ?? "") },
        posts: posts.map((q, i) => ({ rank: i + 1, ...q })),
        score,
      };
      out.ok = true; out.source = "apify-live";
      return out;
    } catch (e) { out.error = String(e.message || e); }
  } else {
    out.error = "no Apify token — set APIFY_TOKEN (or paste one in the modal).";
  }
  // fallback: bundled sample when it's the same profile
  if (slug && slug === liSlug(SAMPLE?.profile?.url)) {
    out.report = SAMPLE; out.ok = true; out.source = "sample";
    out.note = out.error ? "Apify unavailable — used the bundled sample scrape for this profile." : out.note;
  }
  return out;
}

/* ---------------------------------------------------------- X via fxtwitter */
async function fx(path) {
  const r = await jget(`${FX}/${path}`, { headers: { Accept: "application/json", "User-Agent": "naano-clone/1.0" } }, 9000);
  if (!r.ok) throw new Error(`fxtwitter ${r.status} for /${path}`);
  return r.json();
}
export async function scrapeX(profileUrl, postUrls) {
  const out = { ok: false, posts: [] };
  const handle = xHandle(profileUrl);
  if (!handle) { out.error = "Could not read an X handle from that link."; return out; }
  try {
    const u = (await fx(handle)).user || {};
    out.profile = { name: u.name, handle: u.screen_name || handle, bio: u.description || "",
      followers: u.followers ?? null, following: u.following ?? null, tweets: u.tweets ?? null, avatar: u.avatar_url || null };
    out.ok = true;
  } catch (e) { out.error = String(e.message || e); return out; }
  const ids = [...new Set((postUrls || []).map(xPostId).filter(Boolean))].slice(0, 5);
  for (const id of ids) {
    try {
      const t = (await fx(`status/${id}`)).tweet;
      if (t) out.posts.push({ id: t.id, text: t.text, created_at: t.created_at, likes: t.likes || 0,
        views: typeof t.views === "number" ? t.views : (t.views?.count ?? null),
        retweets: t.retweets || 0, replies: t.replies || 0, quotes: t.quotes || 0, bookmarks: t.bookmarks || 0 });
    } catch { /* skip one bad post */ }
  }
  if (ids.length && !out.posts.length) out.posts_note = "Could not fetch the X posts you listed.";
  return out;
}

/* -------------------------------------------- evaluate → Marketplace card */
export const STOP = new Set(("a an the and or but of to in on for with as at by from is are was were be been being this that these those i my me we our you your it its their his her they he she them us not no yes do does did have has had will would can could should may might must about over under into out up down more most very just so than then also via amp rt http https com www").split(/\s+/));
export const TOPIC_MAP = [
  [/\b(b2b)\b/i, "B2B"], [/\b(b2c)\b/i, "B2C"],
  [/\b(a\.?i\.?|artificial intelligence|llm|ml|machine learning|genai|agents?)\b/i, "AI"],
  [/\bsaas\b/i, "SaaS"], [/\b(software|engineer(ing)?|developer|devtools?|api)\b/i, "Software"],
  [/\b(sales|outbound|prospecting|sdr|revenue)\b/i, "Sales"], [/\b(marketing|content|brand|demand gen)\b/i, "Marketing"],
  [/\bseo\b/i, "SEO"], [/\b(outreach|cold email|lemlist)\b/i, "Outreach"], [/\bcrm\b/i, "CRM"],
  [/\b(design|figma|ux|ui)\b/i, "Design"], [/\b(product|productivity|workflow)\b/i, "Productivity"],
  [/\b(fintech|finance|payments?|banking)\b/i, "Fintech"], [/\b(health|healthtech|medical|clinical)\b/i, "HealthTech"],
  [/\b(edtech|education|learning)\b/i, "EdTech"], [/\b(security|cyber|infosec|guardrail|appsec)\b/i, "Cybersecurity"],
  [/\b(growth|gtm|go[- ]to[- ]market)\b/i, "Growth / GTM"], [/\b(hr|recruit(ing|ment)?|people ops|talent)\b/i, "HR"],
  [/\b(e-?commerce|shopify|dtc|retail)\b/i, "E-commerce"], [/\b(data|analytics|bi|warehouse)\b/i, "Data / Analytics"],
  [/\b(dev ?tools?|sdk|open ?source|infrastructure|platform)\b/i, "Developer Tools"],
];

export function evaluate(li, x) {
  const rep = li.ok ? li.report : null;
  const p = rep?.profile || {};
  const liPosts = rep?.posts || [];
  const liFollowers = rep?.metrics?.followers ?? null;
  const der = rep?.score?.derived || {};
  const bio = (p.bio || p.about || x.profile?.bio || "").trim();
  const headline = p.headline
    || (x.profile ? `${x.profile.name || ""}${x.profile.bio ? " — " + x.profile.bio.split("\n")[0] : ""}` : "")
    || "";
  const name = p.name || x.profile?.name || "Your name";

  const avgLikes = liPosts.length ? mean(liPosts.map((q) => q.likes || 0)) : (der.avg_likes || 0);
  const avgComments = liPosts.length ? mean(liPosts.map((q) => q.comments || 0)) : 0;
  const xViews = (x.posts || []).map((q) => q.views).filter((v) => typeof v === "number");
  const engRate = der.engagement_rate_pct != null ? der.engagement_rate_pct
    : (liFollowers ? +((avgLikes / liFollowers) * 100).toFixed(2) : null);

  let impressions = xViews.length ? mean(xViews)
    : avgLikes ? Math.max(avgLikes / 0.02, (liFollowers || 0) * 0.35)
    : (liFollowers ? liFollowers * 0.4 : null);
  impressions = impressions ? Math.round(impressions / 100) * 100 : null;

  const dataThin = liPosts.length < 3 && !x.posts.length;
  let cost = 240;
  if (!dataThin && (liFollowers || x.profile?.followers)) {
    cost = (liFollowers || 0) / 500 + avgLikes * 4
      + Math.min(impressions || 0, 40000) / 1000 * 10
      + Math.min(x.profile?.followers || 0, 50000) / 2500;
    cost = Math.min(2000, Math.max(60, Math.round(cost / 20) * 20));
  }

  const text = [bio, headline, ...liPosts.map((q) => q.text_preview || q.text || ""), ...(x.posts || []).map((q) => q.text || "")].join(" \n ");
  const industries = [];
  for (const [re, label] of TOPIC_MAP) if (re.test(text) && !industries.includes(label)) industries.push(label);
  const freq = {};
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/))
    if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w);

  return {
    name, headline: headline || "Your LinkedIn headline and topics will appear here.", bio,
    industries: industries.slice(0, 3),
    followers: liFollowers, followers_display: liFollowers != null ? nice(liFollowers) : "—",
    x_followers: x.profile?.followers ?? null,
    connections: rep?.metrics?.connections ?? null,
    est_impressions: impressions, est_impressions_display: impressions != null ? nice(impressions) : "—",
    cost_per_post: cost, cost_display: "€" + cost,
    engagement_rate_pct: engRate,
    reactions_per_post: avgLikes ? Math.round(avgLikes) : null,
    comments_per_post: avgComments ? +avgComments.toFixed(1) : (liPosts.length ? 0 : null),
    typical_impressions_per_post: impressions,
    posts_counted: liPosts.length + (x.posts?.length || 0),
    presence_score: rep?.score?.total_out_of_100 ?? null,
    grade: rep?.score?.grade ?? null,
    target_summary: industries.length
      ? `B2B ${industries.slice(0, 2).join(" & ")} audiences on LinkedIn` + (topWords.length ? ` · themes: ${topWords.slice(0, 4).join(", ")}` : "")
      : (topWords.length ? `Estimated themes: ${topWords.slice(0, 5).join(", ")}` : "Target pending — add more public posts."),
    data_ready: !dataThin,
    sources: { linkedin: li.ok ? (li.source || "live") : "unavailable", x: x.ok ? "live" : "unavailable", x_posts: x.posts?.length || 0 },
    notes: [li.note, li.error && `LinkedIn: ${li.error}`, li.posts_error && `LinkedIn posts: ${li.posts_error}`, x.error && `X: ${x.error}`, x.posts_note].filter(Boolean),
    raw: { linkedin: rep, x },
  };
}

/* ------------------------------------------------------------- entry point */
export async function runEvaluate({ linkedinUrl = "", xUrl = "", xPosts = [], apifyToken = "" }) {
  linkedinUrl = String(linkedinUrl).trim();
  xUrl = String(xUrl).trim();
  const posts = Array.isArray(xPosts) ? xPosts : String(xPosts || "").split(/[\s,]+/).filter(Boolean);
  const token = String(apifyToken || process.env.APIFY_TOKEN || "").trim();
  if (!linkedinUrl && !xUrl) throw Object.assign(new Error("Provide a LinkedIn and/or X profile link."), { status: 400 });
  const [li, x] = await Promise.all([
    linkedinUrl ? scrapeLinkedIn(linkedinUrl, token) : Promise.resolve({ ok: false, error: "no LinkedIn link" }),
    xUrl ? scrapeX(xUrl, posts) : Promise.resolve({ ok: false, posts: [], error: "no X link" }),
  ]);
  return { card: evaluate(li, x), linkedin: li, x };
}
