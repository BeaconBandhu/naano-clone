/* Vercel serverless function — GET /api/activity
 * Public, real-time feed of what's actually happening on the platform
 * (signups, campaigns, invites, topups), backed by MongoDB Atlas. No auth
 * required - summaries only, never emails/ids beyond what's already public.
 */
import { listActivity } from "./_lib/activity.mjs";
import { hasMongo } from "./_lib/mongo.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!hasMongo()) {
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ activity: [], mongo: false });
  }
  try {
    const limit = new URL(req.url, "http://x").searchParams.get("limit");
    const activity = await listActivity(limit);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ activity, mongo: true });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
