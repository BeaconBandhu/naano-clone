/* Platform activity feed — the real, MongoDB-backed collection.
 *
 * SQLite (db/schema.sql) stays the system of record for accounts, campaigns,
 * collaborations and the wallet - this doesn't duplicate that. What lands
 * here is an event log: one document per real thing that just happened
 * (a signup, a campaign going live, an invite, a topup). Documents are
 * append-only and each type carries a different shape of `meta`, which is
 * exactly the case a schema-less store fits better than another SQL table.
 *
 * Logging is fire-and-forget from every call site (see accounts.mjs,
 * campaigns.mjs, collaborations.mjs, wallet.mjs): a Mongo hiccup must never
 * fail the real operation, so callers do `logActivity(...).catch(()=>{})`
 * and don't await it.
 */
import { getCollection, hasMongo } from "./mongo.mjs";

export async function logActivity({ type, actorRole, summary, meta }) {
  if (!hasMongo()) return;
  const col = await getCollection("activity");
  await col.insertOne({
    type,
    actorRole: actorRole || null,
    summary,
    meta: meta || {},
    createdAt: new Date(),
  });
}

export async function listActivity(limit = 30) {
  if (!hasMongo()) return [];
  const col = await getCollection("activity");
  const docs = await col.find({}, { sort: { createdAt: -1 }, limit: Math.min(Math.max(Number(limit) || 30, 1), 100) }).toArray();
  return docs.map((d) => ({
    id: String(d._id),
    type: d.type,
    actorRole: d.actorRole,
    summary: d.summary,
    meta: d.meta,
    createdAt: d.createdAt,
  }));
}
