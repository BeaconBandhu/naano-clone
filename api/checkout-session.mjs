/* Vercel serverless function — GET /api/checkout-session?id=cs_test_...
 *   → { paid, amount_total, currency, customer_email }
 * Used by billing.html on return from Stripe Checkout to confirm the
 * payment actually went through before crediting the (demo, localStorage)
 * wallet balance — never trust the redirect alone.
 */
import { retrieveCheckoutSession } from "./_lib/stripe.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const id = new URL(req.url, "http://x").searchParams.get("id");
  try {
    const session = await retrieveCheckoutSession(id);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({
      paid: session.payment_status === "paid",
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_details?.email || null,
    });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
