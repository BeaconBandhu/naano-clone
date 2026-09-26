/* Vercel serverless function — POST /api/auth/logout
 * Deletes the session row server-side (not just the cookie) so the token
 * can't be replayed even if it leaked somewhere.
 */
import { clearCookieHeader, destroySession } from "../_lib/auth.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  destroySession(req);
  res.setHeader("Set-Cookie", clearCookieHeader());
  return res.status(200).json({ ok: true });
}
