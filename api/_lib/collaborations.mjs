import { randomUUID } from "node:crypto";
import { all, get, run } from "./db.mjs";

export function listCollaborationsForBrand(brandId) {
  return all(
    `SELECT co.*, ca.title AS campaign_title, p.name AS creator_name
     FROM collaborations co
     JOIN campaigns ca ON ca.id = co.campaign_id
     JOIN profiles p ON p.id = co.creator_id
     WHERE ca.brand_id = ?
     ORDER BY co.created_at DESC`,
    [brandId]
  );
}

export function listCollaborationsForCreator(creatorId) {
  return all(
    `SELECT co.*, ca.title AS campaign_title, b.name AS brand_name
     FROM collaborations co
     JOIN campaigns ca ON ca.id = co.campaign_id
     JOIN profiles b ON b.id = ca.brand_id
     WHERE co.creator_id = ?
     ORDER BY co.created_at DESC`,
    [creatorId]
  );
}

export function inviteCreator(brandId, { campaignId, creatorId, priceCents }) {
  const campaign = get("SELECT * FROM campaigns WHERE id = ? AND brand_id = ?", [campaignId, brandId]);
  if (!campaign) throw Object.assign(new Error("Campaign not found."), { status: 404 });
  const creator = get("SELECT id FROM profiles WHERE id = ? AND role = 'creator'", [creatorId]);
  if (!creator) throw Object.assign(new Error("Creator not found."), { status: 404 });

  const id = randomUUID();
  run("INSERT INTO collaborations (id, campaign_id, creator_id, price_cents) VALUES (?, ?, ?, ?)", [
    id,
    campaignId,
    creatorId,
    Number.isFinite(priceCents) ? priceCents : null,
  ]);
  return get("SELECT * FROM collaborations WHERE id = ?", [id]);
}

/** Either side can move a collaboration through its status - creators
 * accept/decline/deliver, brands mark paid. Ownership is checked either way
 * so one side can't edit the other's collaboration. */
export function setCollaborationStatus(user, collabId, { status, postUrl }) {
  const row = get(
    `SELECT co.*, ca.brand_id FROM collaborations co
     JOIN campaigns ca ON ca.id = co.campaign_id
     WHERE co.id = ?`,
    [collabId]
  );
  if (!row) throw Object.assign(new Error("Collaboration not found."), { status: 404 });
  const owns = user.role === "creator" ? row.creator_id === user.id : row.brand_id === user.id;
  if (!owns) throw Object.assign(new Error("Not your collaboration."), { status: 403 });

  const valid = ["invited", "accepted", "declined", "delivered", "paid"];
  if (status && !valid.includes(status)) {
    throw Object.assign(new Error(`status must be one of: ${valid.join(", ")}`), { status: 400 });
  }
  run("UPDATE collaborations SET status = COALESCE(?, status), post_url = COALESCE(?, post_url) WHERE id = ?", [
    status || null,
    postUrl || null,
    collabId,
  ]);
  return get("SELECT * FROM collaborations WHERE id = ?", [collabId]);
}
