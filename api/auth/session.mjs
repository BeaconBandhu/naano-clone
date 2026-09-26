/* Vercel serverless function — GET /api/auth/session
 *   -> { user } if logged in, { user: null } otherwise (200 either way -
 *   this is a status check, not an authorization gate, so "not logged in"
 *   isn't an error).
 */
import { getSessionUser } from "../_lib/auth.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("cache-control", "no-store");
  return res.status(200).json({ user: getSessionUser(req) });
}
