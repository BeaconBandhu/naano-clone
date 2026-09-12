/* Vercel serverless function — POST /api/scrape-company
 *   body: { url }
 *   → brand profile scraped from the company's own website (open source:
 *     plain fetch + regex, no paid API, no HTML-parsing dependency)
 * Powers the brand onboarding "Reading your brand..." step.
 */
import { scrapeCompanyWebsite } from "./_lib/scrape-company.mjs";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hint: "POST { url: 'acme.com' }" });
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
    const result = await scrapeCompanyWebsite(body?.url);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
