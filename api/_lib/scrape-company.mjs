/* Open-source company-website scraper — no paid API, no HTML-parsing
 * dependency. Just `fetch` (Node 18+ built-in) plus regex over the standard
 * <head> meta tags and stripped body text, matching this repo's existing
 * zero-dependency convention (see api/_lib/scrape.mjs for LinkedIn/X).
 *
 * Powers the brand onboarding "Reading your brand..." step
 * (POST /api/scrape-company). Given a company URL, returns name, tagline,
 * logo, social links, a text sample, and inferred industries — reusing the
 * same TOPIC_MAP keyword classifier already used for creator profiles, so a
 * brand and a creator land on the same industry vocabulary.
 *
 * `icps` (3 buyer-persona cards) is a HEURISTIC stand-in for what the real
 * Naano product does with an LLM call reading the site (see the "Value prop
 * & ICP" step in the 2026-09-13 brand walkthrough — its personas are
 * genuinely written per-company: "Third-Party Seller / E-commerce
 * Entrepreneur", etc.). This scraper is deliberately regex-only, no paid
 * API, so it can't write that copy — instead it maps detected industries to
 * a fixed table of named buyer roles and backfills with generic B2B
 * buying-committee roles (economic buyer / technical evaluator / end user)
 * when fewer than 3 industries are detected. Same shape, less sharp content;
 * swap in a real LLM call here later if that gap matters.
 */
import { STOP, TOPIC_MAP } from "./scrape.mjs";

const ICP_BY_INDUSTRY = {
  "AI": { title: "AI/ML Technical Buyer", description: "Engineering and data leaders evaluating AI tooling for their team." },
  "Software": { title: "Software Decision Maker", description: "Technical leaders making the build-vs-buy call on core infrastructure." },
  "SaaS": { title: "SaaS Operator", description: "Founders and ops leads running a subscription software business." },
  "Sales": { title: "Sales Leader", description: "VPs and heads of sales accountable for pipeline and revenue." },
  "Marketing": { title: "Marketing Decision Maker", description: "CMOs and growth leads allocating budget across channels." },
  "SEO": { title: "Growth / SEO Lead", description: "Practitioners focused on organic acquisition and search visibility." },
  "Outreach": { title: "Outbound / SDR Leader", description: "Teams running cold outreach and pipeline generation at scale." },
  "CRM": { title: "RevOps Buyer", description: "Operations leaders managing the customer data and sales stack." },
  "Design": { title: "Design / Product Leader", description: "Heads of design and product shipping customer-facing experiences." },
  "Productivity": { title: "Productivity Buyer", description: "Ops and team leads streamlining internal workflows." },
  "Fintech": { title: "Finance Decision Maker", description: "Finance and payments leaders evaluating infrastructure providers." },
  "HealthTech": { title: "Healthcare Buyer", description: "Clinical and health-ops leaders assessing new tooling." },
  "EdTech": { title: "Education Buyer", description: "Academic and L&D leaders choosing learning tools." },
  "Cybersecurity": { title: "Security Leader", description: "CISOs and security engineers vetting new tools for risk." },
  "Growth / GTM": { title: "GTM Leader", description: "Cross-functional leaders owning go-to-market execution." },
  "HR": { title: "People / Talent Leader", description: "HR and recruiting leaders sourcing new hires and tools." },
  "E-commerce": { title: "E-commerce Operator", description: "Merchants and DTC brand operators running online storefronts." },
  "Data / Analytics": { title: "Data Leader", description: "Analytics and BI leaders standardizing on a data stack." },
  "Developer Tools": { title: "Developer Buyer", description: "Engineers and platform teams adopting new dev tooling." },
  "B2B": { title: "B2B Buyer", description: "Business decision-makers evaluating vendors for their team." },
  "B2C": { title: "Consumer Shopper", description: "Everyday consumers deciding what to buy." },
};

const GENERIC_ICPS = [
  { title: "Economic Buyer", description: "The budget holder who signs off on new spend." },
  { title: "Technical Evaluator", description: "The person who vets whether the product actually fits the stack." },
  { title: "End User", description: "The person who uses the product day to day." },
];

function buildIcps(industries) {
  const picked = [];
  for (const label of industries) {
    const t = ICP_BY_INDUSTRY[label];
    if (t && !picked.some((p) => p.title === t.title)) picked.push(t);
    if (picked.length === 3) break;
  }
  for (const g of GENERIC_ICPS) {
    if (picked.length === 3) break;
    if (!picked.some((p) => p.title === g.title)) picked.push(g);
  }
  return picked.slice(0, 3).map((p, i) => ({ rank: i + 1, ...p }));
}

const UA = "Mozilla/5.0 (compatible; NaanoBrandScan/1.0; +https://naano.com)";
const FETCH_TIMEOUT_MS = 10000;

const SOCIAL_PATTERNS = {
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|school)\/[A-Za-z0-9_-]+\/?/i,
  x: /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?!(?:i|home|search|hashtag|share|intent)\/)[A-Za-z0-9_]{1,15}\/?/i,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?/i,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[A-Za-z0-9_-]+\/?/i,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9.]+\/?/i,
};

function tag(html, re) {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : null;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/gi, "’")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))) // hex, e.g. &#x27;
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))); // decimal, e.g. &#39;
}

function meta(html, name) {
  // handles both attribute orders: name/property first or content first
  const a = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return tag(html, a) || tag(html, b);
}

function normalizeUrl(input) {
  let s = String(input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return u.toString();
  } catch {
    return null;
  }
}

function resolve(base, maybeRelative) {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function extractSocials(html) {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const out = {};
  for (const [key, re] of Object.entries(SOCIAL_PATTERNS)) {
    const hit = hrefs.find((h) => re.test(h));
    if (hit) out[key] = hit.match(re)[0];
  }
  return out;
}

function bodyText(html, limit = 4000) {
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const text = decodeEntities(noScripts.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.slice(0, limit);
}

function inferIndustries(text) {
  const industries = [];
  for (const [re, label] of TOPIC_MAP) if (re.test(text) && !industries.includes(label)) industries.push(label);
  return industries.slice(0, 5);
}

// Approximates the video's "4 to 6 sentences" value prop: the meta
// description is usually 1-2 sentences, so pad it with the next few
// sentences of real body copy (deduped) rather than inventing text.
function buildValueProp(description, bodyTextFull, name) {
  const sentences = (s) => (s || "").match(/[^.!?]+[.!?]+/g) || [];
  const have = sentences(description);
  const seen = new Set(have.map((s) => s.trim().toLowerCase()));
  for (const s of sentences(bodyTextFull)) {
    if (have.length >= 6) break;
    const t = s.trim();
    if (t.length < 25 || t.length > 240) continue; // skip nav crumbs / run-on blocks
    if (seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    have.push(t);
  }
  const para = have.slice(0, 6).join(" ").trim();
  return para || `${name} — no public description found; edit this before continuing.`;
}

function topKeywords(text, n = 6) {
  const freq = {};
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)) {
    if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

async function fetchHtml(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw Object.assign(new Error(`Site returned HTTP ${res.status}`), { status: 502 });
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } finally {
    clearTimeout(t);
  }
}

export async function scrapeCompanyWebsite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) throw Object.assign(new Error("Enter a valid website (e.g. acme.com)."), { status: 400 });

  let html, finalUrl;
  try {
    ({ html, finalUrl } = await fetchHtml(url));
  } catch (e) {
    throw Object.assign(
      new Error(e?.name === "AbortError" ? "Site took too long to respond." : `Could not reach that site: ${e.message}`),
      { status: e?.status || 502 }
    );
  }

  const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  const title = tag(html, /<title[^>]*>([^<]*)<\/title>/i);
  const ogSiteName = meta(html, "og:site_name");
  const ogTitle = meta(html, "og:title");
  const description = meta(html, "description") || meta(html, "og:description") || null;
  const ogImage = resolve(finalUrl, meta(html, "og:image"));
  const iconHref =
    tag(html, /<link[^>]+rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*href=["']([^"']*)["']/i) ||
    tag(html, /<link[^>]+href=["']([^"']*)["'][^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["']/i);
  const favicon = resolve(finalUrl, iconHref) || `${new URL(finalUrl).origin}/favicon.ico`;
  const themeColor = meta(html, "theme-color");
  const socials = extractSocials(html);
  const text = bodyText(html);
  const industries = inferIndustries([title, description, ogTitle, text].filter(Boolean).join(" \n "));
  const keywords = topKeywords(text);

  const name =
    ogSiteName ||
    (ogTitle || title || domain).split(/[|–—-]/)[0].trim() ||
    domain;
  const valueProp = buildValueProp(description, text, name);
  const icps = buildIcps(industries);

  return {
    ok: true,
    source: "open-source-scrape",
    url: finalUrl,
    domain,
    name,
    tagline: ogTitle && ogTitle !== name ? ogTitle : null,
    description,
    valueProp,
    icps,
    logo: ogImage || favicon,
    favicon,
    themeColor,
    socials,
    industries,
    keywords,
    textSample: text.slice(0, 600),
  };
}
