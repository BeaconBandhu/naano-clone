/* Vercel serverless function — POST /api/evaluate
 *   body: { linkedinUrl, xUrl, xPosts?: string[]|string, apifyToken? }
 *   → { card, linkedin, x }
 * Set APIFY_TOKEN in the Vercel project's Environment Variables for live
 * LinkedIn scrapes; without it, /in/aranyabandhu/ uses a bundled sample.
 */
import { runEvaluate } from "./_lib/scrape.mjs";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hint: "POST { linkedinUrl, xUrl, xPosts?, apifyToken? }", hasToken: !!process.env.APIFY_TOKEN });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body = req.body;
  if (body == null || typeof body === "string") {
    try {
      let raw = typeof body === "string" ? body : "";
      if (!raw) { for await (const c of req) raw += c; }
      body = raw ? JSON.parse(raw) : {};
    } catch { return res.status(400).json({ error: "Invalid JSON body." }); }
  }
  try {
    const result = await runEvaluate(body || {});
    res.setHeader("cache-control", "no-store");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
