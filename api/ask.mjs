/* Vercel serverless function — POST /api/ask
 *   body: { query, top_k? }
 *   -> { answer, grounded, sources } — see api/_lib/rag.mjs for how.
 * Powers the naano-chat-widget.js floating assistant.
 */
import { ask } from "./_lib/rag.mjs";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hint: "POST { query: 'How much can I earn?' }" });
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
  if (!body?.query || typeof body.query !== "string") {
    return res.status(400).json({ error: "body.query (string) is required." });
  }
  try {
    const result = await ask(body.query, body.top_k ? Number(body.top_k) : undefined);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
