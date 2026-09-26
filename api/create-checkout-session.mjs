/* Vercel serverless function — POST /api/create-checkout-session
 *   body: { amountCents, currency?, description?, customerEmail?, successUrl, cancelUrl }
 *   → { id, url }   (redirect the browser to `url` — Stripe's hosted Checkout)
 * TEST MODE ONLY: needs STRIPE_SECRET_KEY (sk_test_...) — see api/_lib/stripe.mjs.
 */
import { requireSessionUser } from "./_lib/auth.mjs";
import { readJsonBody } from "./_lib/http.mjs";
import { createCheckoutSession } from "./_lib/stripe.mjs";

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hasKey: !!process.env.STRIPE_SECRET_KEY });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  try {
    // Who this wallet top-up belongs to has to come from the server-verified
    // session, never from the request body - otherwise anyone could credit
    // anyone else's wallet by passing a different id.
    const user = requireSessionUser(req);
    const session = await createCheckoutSession({
      plan: body?.plan,
      priceId: body?.priceId,
      mode: body?.mode,
      amountCents: body?.amountCents != null ? Number(body.amountCents) : undefined,
      currency: body?.currency || "eur",
      description: body?.description,
      customerEmail: body?.customerEmail || user.email,
      clientReferenceId: user.id,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
