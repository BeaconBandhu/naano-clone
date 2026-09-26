/* Naano clone — local dev server.
 *   node server/serve.mjs            → http://localhost:5173
 * Serves the repo statically and runs POST /api/evaluate through the SAME code
 * the Vercel function uses (api/_lib/scrape.mjs), so local behaves like deployed.
 *
 * Env: PORT (5173), APIFY_TOKEN (optional — else /in/aranyabandhu/ uses the
 * bundled sample; other profiles need a token, pasted in the modal or set here).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runEvaluate } from "../api/_lib/scrape.mjs";
import { scrapeCompanyWebsite } from "../api/_lib/scrape-company.mjs";
import { retrieveCheckoutSession } from "../api/_lib/stripe.mjs";
import { ask as askRag } from "../api/_lib/rag.mjs";

// These new endpoints are real business logic (auth, wallet, campaigns...),
// not thin wrappers - imported directly and run as-is (rather than
// reimplemented inline like the handlers above) so local dev can never drift
// from what Vercel actually runs. Works because Node's raw IncomingMessage
// is already the async-iterable-of-chunks these handlers read bodies from,
// and ServerResponse already has setHeader() - only status()/json() need
// adding, see decorateResponse() below.
import stripeWebhookHandler from "../api/webhooks/stripe.mjs";
import authSignupHandler from "../api/auth/signup.mjs";
import authLoginHandler from "../api/auth/login.mjs";
import authLogoutHandler from "../api/auth/logout.mjs";
import authSessionHandler from "../api/auth/session.mjs";
import profileHandler from "../api/profile.mjs";
import creatorsHandler from "../api/creators.mjs";
import campaignsHandler from "../api/campaigns.mjs";
import collaborationsHandler from "../api/collaborations.mjs";
import walletHandler from "../api/wallet.mjs";
import createCheckoutSessionHandler from "../api/create-checkout-session.mjs";

function decorateResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader("content-type")) res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", res.getHeader("cache-control") || "no-store");
    res.end(JSON.stringify(obj, null, 2));
  };
  return res;
}

const VERCEL_STYLE_ROUTES = {
  "/api/webhooks/stripe": stripeWebhookHandler,
  "/api/create-checkout-session": createCheckoutSessionHandler,
  "/api/auth/signup": authSignupHandler,
  "/api/auth/login": authLoginHandler,
  "/api/auth/logout": authLogoutHandler,
  "/api/auth/session": authSessionHandler,
  "/api/profile": profileHandler,
  "/api/creators": creatorsHandler,
  "/api/campaigns": campaignsHandler,
  "/api/collaborations": collaborationsHandler,
  "/api/wallet": walletHandler,
};

const ROOT = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const PORT = +(process.env.PORT || 5173);

// load repo-root .env (no dependency) so `APIFY_TOKEN=...` in .env just works
try {
  const env = await readFile(join(ROOT, ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env — fine */ }
// charset=utf-8 on the text types: without it, a client that respects HTTP's
// charset-sniffing rules (e.g. Python's `requests`) defaults text/* to
// ISO-8859-1 per spec, silently mangling this repo's UTF-8 content (curly
// quotes, "€", em dashes) for anything that fetches these pages rather than
// rendering them in a browser (browsers guess right anyway via <meta
// charset>, which is why this was invisible in normal use).
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".map": "application/json" };

const json = (res, code, obj) =>
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(obj, null, 2));

async function handleEvaluate(req, res) {
  let raw = ""; for await (const c of req) raw += c;
  let body; try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "bad JSON" }); }
  try { return json(res, 200, await runEvaluate(body)); }
  catch (e) { return json(res, e?.status || 500, { error: String(e?.message || e) }); }
}

async function handleScrapeCompany(req, res) {
  let raw = ""; for await (const c of req) raw += c;
  let body; try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "bad JSON" }); }
  try { return json(res, 200, await scrapeCompanyWebsite(body?.url)); }
  catch (e) { return json(res, e?.status || 500, { error: String(e?.message || e) }); }
}

// create-checkout-session and the stripe webhook are both real business
// logic now (auth + client_reference_id attribution; wallet crediting) -
// run via VERCEL_STYLE_ROUTES below instead of being reimplemented here.

async function handleCheckoutSessionStatus(req, res) {
  const id = new URL(req.url, "http://x").searchParams.get("id");
  try {
    const session = await retrieveCheckoutSession(id);
    return json(res, 200, {
      paid: session.payment_status === "paid",
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email || null,
    });
  } catch (e) { return json(res, e?.status || 500, { error: String(e?.message || e) }); }
}

async function handleAsk(req, res) {
  let raw = ""; for await (const c of req) raw += c;
  let body; try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "bad JSON" }); }
  if (!body?.query || typeof body.query !== "string") return json(res, 400, { error: "body.query (string) is required." });
  try { return json(res, 200, await askRag(body.query, body.top_k ? Number(body.top_k) : undefined)); }
  catch (e) { return json(res, e?.status || 500, { error: String(e?.message || e) }); }
}

async function serveStatic(req, res) {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/") path = "/index.html";
  const abs = normalize(join(ROOT, path));
  if (!abs.startsWith(ROOT + sep) && abs !== ROOT) return res.writeHead(403).end("no");
  try {
    const s = await stat(abs);
    if (s.isDirectory()) return serveStatic({ ...req, url: join(path, "index.html") }, res);
    res.writeHead(200, { "content-type": MIME[extname(abs).toLowerCase()] || "application/octet-stream" });
    res.end(await readFile(abs));
  } catch { res.writeHead(404, { "content-type": "text/plain" }).end("Not found"); }
}

createServer((req, res) => {
  const path = req.url.split("?")[0];
  if (path === "/api/evaluate" && req.method === "POST") return handleEvaluate(req, res).catch((e) => json(res, 500, { error: String(e) }));
  if (path === "/api/evaluate") return json(res, 200, { ok: true, hasToken: !!process.env.APIFY_TOKEN });
  if (path === "/api/scrape-company" && req.method === "POST") return handleScrapeCompany(req, res).catch((e) => json(res, 500, { error: String(e) }));
  if (path === "/api/scrape-company") return json(res, 200, { ok: true, hint: "POST { url }" });
  if (path === "/api/checkout-session" && req.method === "GET") return handleCheckoutSessionStatus(req, res).catch((e) => json(res, 500, { error: String(e) }));
  if (path === "/api/ask" && req.method === "POST") return handleAsk(req, res).catch((e) => json(res, 500, { error: String(e) }));
  if (path === "/api/ask") return json(res, 200, { ok: true, hasKey: !!process.env.OPENAI_API_KEY, hint: "POST { query: '...' }" });
  const vercelHandler = VERCEL_STYLE_ROUTES[path];
  if (vercelHandler) return Promise.resolve(vercelHandler(req, decorateResponse(res))).catch((e) => json(res, 500, { error: String(e) }));
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`\n  Naano clone  →  http://localhost:${PORT}   (app: /app/signin.html)`);
  console.log(`  Apify token:  ${process.env.APIFY_TOKEN ? "set" : "not set (sample fallback for /in/aranyabandhu/)"}`);
  console.log(`  Stripe key:   ${process.env.STRIPE_SECRET_KEY ? "set" + (process.env.STRIPE_SECRET_KEY.startsWith("sk_test_") ? " (test)" : " (⚠ not sk_test_ — check it's a sandbox key)") : "NOT SET — Billing → Add budget and any fixed-price checkout will fail until you add one"}`);
  console.log(`  Stripe prices: ${["STRIPE_PRICE_TOPUP_100","STRIPE_PRICE_TOPUP_200","STRIPE_PRICE_TOPUP_300","STRIPE_PRICE_STARTER","STRIPE_PRICE_PRO","STRIPE_PRICE_BUSINESS"].filter((k) => process.env[k]).length}/6 set`);
  console.log(`  Webhook secret: ${process.env.STRIPE_WEBHOOK_SECRET ? "set" : "not set — /api/webhooks/stripe will reject everything"}`);
  console.log(`  OpenAI key:   ${process.env.OPENAI_API_KEY ? "set" : "NOT SET — the chat widget (/api/ask) will return 503"}`);
  console.log(`  Database:     SQLite at data/naano.db (auto-created on first request; see api/_lib/db.mjs)\n`);
});
