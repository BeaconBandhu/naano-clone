/* Vercel serverless function — /api/tools/{evaluate,scrape-company}
 * Same consolidation trick as api/auth/[action].mjs: merging these two into
 * one dynamic route makes room for api/activity.mjs under Vercel's Hobby
 * 12-function cap, without changing either endpoint's behavior.
 *   POST /api/tools/evaluate       body: { linkedinUrl, xUrl, xPosts?, apifyToken? }
 *   POST /api/tools/scrape-company body: { url }
 */
import { runEvaluate } from "../_lib/scrape.mjs";
import { scrapeCompanyWebsite } from "../_lib/scrape-company.mjs";

export const config = { maxDuration: 60 };

async function readBody(req) {
  let body = req.body;
  if (body == null || typeof body === "string") {
    let raw = typeof body === "string" ? body : "";
    if (!raw) { for await (const c of req) raw += c; }
    body = raw ? JSON.parse(raw) : {};
  }
  return body;
}

export default async function handler(req, res) {
  const action = req.query?.action || req.url.split("?")[0].split("/").filter(Boolean).pop();

  if (req.method === "GET") {
    if (action === "evaluate") return res.status(200).json({ ok: true, hint: "POST { linkedinUrl, xUrl, xPosts?, apifyToken? }", hasToken: !!process.env.APIFY_TOKEN });
    if (action === "scrape-company") return res.status(200).json({ ok: true, hint: "POST { url: 'acme.com' }" });
    return res.status(404).json({ error: `Unknown tool "${action}".` });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body;
    switch (action) {
      case "evaluate":
        body = await readBody(req);
        res.setHeader("cache-control", "no-store");
        return res.status(200).json(await runEvaluate(body || {}));
      case "scrape-company":
        body = await readBody(req);
        res.setHeader("cache-control", "no-store");
        return res.status(200).json(await scrapeCompanyWebsite(body?.url));
      default:
        return res.status(404).json({ error: `Unknown tool "${action}".` });
    }
  } catch (e) {
    if (e instanceof SyntaxError) return res.status(400).json({ error: "Invalid JSON body." });
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
