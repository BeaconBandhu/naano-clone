/* Real wallet, backed by wallet_ledger (db/schema.sql). Balance is derived
 * (SUM of the ledger), never stored as a separate counter - there is
 * nothing to drift out of sync with its own history.
 *
 * This is the fix for the gap api/webhooks/stripe.mjs has documented since
 * it was first written: the webhook could verify a real Stripe event but
 * had nowhere server-side to persist "this got paid". Now it does.
 */
import { randomUUID } from "node:crypto";
import { all, get, run } from "./db.mjs";
import { logActivity } from "./activity.mjs";

export function getBalanceCents(brandId) {
  const row = get("SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM wallet_ledger WHERE brand_id = ?", [
    brandId,
  ]);
  return row.balance;
}

export function listLedger(brandId, limit = 50) {
  return all("SELECT * FROM wallet_ledger WHERE brand_id = ? ORDER BY created_at DESC LIMIT ?", [
    brandId,
    limit,
  ]);
}

/**
 * Idempotent: `stripeSessionId` is UNIQUE in the schema, so a Stripe webhook
 * retry (Stripe does this on anything but a fast 2xx) can call this again
 * safely - the second call just no-ops instead of double-crediting.
 * Returns true if a new row was written, false if this session was already
 * credited.
 */
export async function creditTopup({ brandId, amountCents, stripeSessionId, description }) {
  try {
    run(
      "INSERT INTO wallet_ledger (id, brand_id, type, amount_cents, stripe_session_id, description) VALUES (?, ?, 'topup', ?, ?, ?)",
      [randomUUID(), brandId, amountCents, stripeSessionId, description || null]
    );
    await logActivity({ type: "wallet_topup", actorRole: "brand", summary: `A brand added ${(amountCents / 100).toFixed(2)}€ to their wallet.`, meta: { amountCents } }).catch(() => {});
    return true;
  } catch (e) {
    if (String(e?.message || "").includes("UNIQUE")) return false; // already credited
    throw e;
  }
}

export function recordSpend({ brandId, amountCents, description }) {
  run("INSERT INTO wallet_ledger (id, brand_id, type, amount_cents, description) VALUES (?, ?, 'spend', ?, ?)", [
    randomUUID(),
    brandId,
    -Math.abs(amountCents),
    description || null,
  ]);
}
