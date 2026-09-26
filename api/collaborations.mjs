/* Vercel serverless function — GET/POST/PATCH /api/collaborations
 *   GET   -> { collaborations } for the signed-in user (either role)
 *   POST  body: { campaignId, creatorId, priceCents? } -> { collaboration }  (brand only: invite a creator)
 *   PATCH body: { id, status?, postUrl? } -> { collaboration }              (either side, ownership-checked)
 */
import { requireSessionUser } from "./_lib/auth.mjs";
import {
  inviteCreator,
  listCollaborationsForBrand,
  listCollaborationsForCreator,
  setCollaborationStatus,
} from "./_lib/collaborations.mjs";
import { readJsonBody } from "./_lib/http.mjs";

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = requireSessionUser(req);

    if (req.method === "GET") {
      res.setHeader("cache-control", "no-store");
      const collaborations =
        user.role === "brand" ? listCollaborationsForBrand(user.id) : listCollaborationsForCreator(user.id);
      return res.status(200).json({ collaborations });
    }

    if (req.method === "POST") {
      if (user.role !== "brand") return res.status(403).json({ error: "Only brands invite creators." });
      const body = await readJsonBody(req);
      const collaboration = await inviteCreator(user.id, body);
      return res.status(200).json({ collaboration });
    }

    // PATCH
    const body = await readJsonBody(req);
    if (!body.id) return res.status(400).json({ error: "id is required." });
    const collaboration = await setCollaborationStatus(user, body.id, body);
    return res.status(200).json({ collaboration });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
