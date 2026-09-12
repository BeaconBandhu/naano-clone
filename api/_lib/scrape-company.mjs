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
 */
import { STOP, TOPIC_MAP } from "./scrape.mjs";

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
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
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

  return {
    ok: true,
    source: "open-source-scrape",
    url: finalUrl,
    domain,
    name,
    tagline: ogTitle && ogTitle !== name ? ogTitle : null,
    description,
    logo: ogImage || favicon,
    favicon,
    themeColor,
    socials,
    industries,
    keywords,
    textSample: text.slice(0, 600),
  };
}
