/* Vercel serverless function — GET /api/wallet
 *   -> { balanceCents, ledger: [...] } for the signed-in brand.
 * Replaces billing.html's old localStorage-only wallet.
 */
import { requireSessionUser } from "./_lib/auth.mjs";
import { getBalanceCents, listLedger } from "./_lib/wallet.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const user = requireSessionUser(req);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({
      balanceCents: getBalanceCents(user.id),
      ledger: listLedger(user.id),
    });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
