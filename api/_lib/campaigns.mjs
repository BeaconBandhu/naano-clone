import { randomUUID } from "node:crypto";
import { all, get, run } from "./db.mjs";
import { logActivity } from "./activity.mjs";

export function listCampaignsForBrand(brandId) {
  return all("SELECT * FROM campaigns WHERE brand_id = ? ORDER BY created_at DESC", [brandId]);
}

export async function createCampaign(brandId, { title, brief, budgetCents }) {
  title = String(title || "").trim();
  if (!title) throw Object.assign(new Error("title is required."), { status: 400 });
  const id = randomUUID();
  run("INSERT INTO campaigns (id, brand_id, title, brief, budget_cents) VALUES (?, ?, ?, ?, ?)", [
    id,
    brandId,
    title,
    brief || null,
    Number.isFinite(budgetCents) ? budgetCents : 0,
  ]);
  await logActivity({ type: "campaign_created", actorRole: "brand", summary: `A new campaign, "${title}", went live.`, meta: { campaignId: id } }).catch(() => {});
  return get("SELECT * FROM campaigns WHERE id = ?", [id]);
}

export function setCampaignStatus(brandId, campaignId, status) {
  const valid = ["draft", "active", "completed", "cancelled"];
  if (!valid.includes(status)) {
    throw Object.assign(new Error(`status must be one of: ${valid.join(", ")}`), { status: 400 });
  }
  const campaign = get("SELECT * FROM campaigns WHERE id = ? AND brand_id = ?", [campaignId, brandId]);
  if (!campaign) throw Object.assign(new Error("Campaign not found."), { status: 404 });
  run("UPDATE campaigns SET status = ? WHERE id = ?", [status, campaignId]);
  return get("SELECT * FROM campaigns WHERE id = ?", [campaignId]);
}
