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
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".map": "application/json" };

const json = (res, code, obj) =>
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }).end(JSON.stringify(obj, null, 2));

async function handleEvaluate(req, res) {
  let raw = ""; for await (const c of req) raw += c;
  let body; try { body = JSON.parse(raw || "{}"); } catch { return json(res, 400, { error: "bad JSON" }); }
  try { return json(res, 200, await runEvaluate(body)); }
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
  if (req.url.split("?")[0] === "/api/evaluate" && req.method === "POST") return handleEvaluate(req, res).catch((e) => json(res, 500, { error: String(e) }));
  if (req.url.split("?")[0] === "/api/evaluate") return json(res, 200, { ok: true, hasToken: !!process.env.APIFY_TOKEN });
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`\n  Naano clone  →  http://localhost:${PORT}   (app: /app/signin.html)`);
  console.log(`  Apify token: ${process.env.APIFY_TOKEN ? "set" : "not set (sample fallback for /in/aranyabandhu/)"}\n`);
});
