/* Vercel serverless function — GET/PUT /api/profile
 *   GET -> the signed-in user's real profile (creator card or brand profile)
 *   PUT body: role-appropriate fields (see api/_lib/profiles.mjs) -> updated profile
 */
import { requireSessionUser } from "./_lib/auth.mjs";
import { readJsonBody } from "./_lib/http.mjs";
import { getProfile, updateBrandProfile, updateCreatorCard } from "./_lib/profiles.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = requireSessionUser(req);
    if (req.method === "PUT") {
      const body = await readJsonBody(req);
      if (user.role === "creator") updateCreatorCard(user.id, body);
      else updateBrandProfile(user.id, body);
    }
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ profile: getProfile(user) });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
