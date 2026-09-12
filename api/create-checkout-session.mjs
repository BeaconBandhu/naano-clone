/* Vercel serverless function — POST /api/create-checkout-session
 *   body: { amountCents, currency?, description?, customerEmail?, successUrl, cancelUrl }
 *   → { id, url }   (redirect the browser to `url` — Stripe's hosted Checkout)
 * TEST MODE ONLY: needs STRIPE_SECRET_KEY (sk_test_...) — see api/_lib/stripe.mjs.
 */
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
  let body = req.body;
  if (body == null || typeof body === "string") {
    try {
      let raw = typeof body === "string" ? body : "";
      if (!raw) { for await (const c of req) raw += c; }
      body = raw ? JSON.parse(raw) : {};
    } catch { return res.status(400).json({ error: "Invalid JSON body." }); }
  }
  try {
    const session = await createCheckoutSession({
      amountCents: Number(body?.amountCents),
      currency: body?.currency || "eur",
      description: body?.description,
      customerEmail: body?.customerEmail,
      successUrl: body?.successUrl,
      cancelUrl: body?.cancelUrl,
    });
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ id: session.id, url: session.url });
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
