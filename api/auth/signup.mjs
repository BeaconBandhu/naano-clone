/* Vercel serverless function — POST /api/auth/signup
 *   body: { email, password, role: "creator"|"brand", name? }
 *   -> { user } + sets an httpOnly session cookie
 */
import { signup } from "../_lib/accounts.mjs";
import { sessionCookieHeader } from "../_lib/auth.mjs";
import { readJsonBody } from "../_lib/http.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  try {
    const { user, sessionToken } = signup(body);
    res.setHeader("Set-Cookie", sessionCookieHeader(sessionToken));
    return res.status(200).json({ user });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
