/* Vercel serverless function — GET /api/creators
 *   -> { creators: [...] } — real signups from the database, not a
 *   hardcoded demo array. Empty array on a fresh database is the correct,
 *   honest answer (no creators have signed up yet), not a bug.
 */
import { listCreators } from "./_lib/creators.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("cache-control", "no-store");
  return res.status(200).json({ creators: listCreators() });
}
