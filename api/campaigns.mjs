/* Vercel serverless function — GET/POST /api/campaigns
 *   GET  -> { campaigns } for the signed-in brand
 *   POST body: { title, brief?, budgetCents? } -> { campaign }
 * Backs the brand dashboard's "Campaigns" nav item (previously href="#").
 */
import { createCampaign, listCampaignsForBrand } from "./_lib/campaigns.mjs";
import { requireSessionUser } from "./_lib/auth.mjs";
import { readJsonBody } from "./_lib/http.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = requireSessionUser(req);
    if (user.role !== "brand") {
      return res.status(403).json({ error: "Only brand accounts have campaigns." });
    }
    if (req.method === "GET") {
      res.setHeader("cache-control", "no-store");
      return res.status(200).json({ campaigns: listCampaignsForBrand(user.id) });
    }
    const body = await readJsonBody(req);
    const campaign = await createCampaign(user.id, body);
    return res.status(200).json({ campaign });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
