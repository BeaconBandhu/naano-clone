/* Vercel serverless function — POST /api/webhooks/stripe
 * Stripe's servers call this directly (never the browser) the moment a
 * checkout / subscription event happens. Verified with STRIPE_WEBHOOK_SECRET
 * via pure HMAC (api/_lib/stripe-webhook.mjs) — no Stripe API call, so this
 * endpoint works even without STRIPE_SECRET_KEY set.
 *
 * This now does the real write it could previously only log about: on
 * checkout.session.completed, credits wallet_ledger for the brand named in
 * client_reference_id (set at checkout-session creation in
 * api/create-checkout-session.mjs from the server-verified session, never
 * from client input). Idempotent on stripe_session_id (UNIQUE in the
 * schema) — a Stripe retry of the same event just no-ops on the second
 * delivery instead of double-crediting.
 */
import { SignatureVerificationError, verifyStripeSignature } from "../_lib/stripe-webhook.mjs";
import { creditTopup } from "../_lib/wallet.mjs";

// Signature verification needs the exact raw bytes Stripe sent — must not
// let Vercel's default body parser touch this request first.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const raw = await readRawBody(req);
  let event;
  try {
    event = verifyStripeSignature(raw, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    const status = e instanceof SignatureVerificationError ? 400 : 500;
    console.warn("[stripe-webhook] rejected:", e.message);
    return res.status(status).json({ error: e.message });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      console.log(
        `[stripe-webhook] checkout.session.completed id=${s.id} mode=${s.mode} ` +
          `amount_total=${s.amount_total} ${s.currency} payment_status=${s.payment_status} ` +
          `customer_email=${s.customer_details?.email || "n/a"} brand=${s.client_reference_id || "n/a"}`
      );
      if (s.mode === "payment" && s.payment_status === "paid" && s.client_reference_id) {
        const credited = await creditTopup({
          brandId: s.client_reference_id,
          amountCents: s.amount_total,
          stripeSessionId: s.id,
          description: `Stripe top-up (${s.currency?.toUpperCase()})`,
        });
        console.log(
          credited
            ? `[stripe-webhook] credited ${s.amount_total} to brand ${s.client_reference_id}`
            : `[stripe-webhook] session ${s.id} already credited (retry) - no-op`
        );
      } else if (s.mode === "payment" && !s.client_reference_id) {
        // Shouldn't happen via create-checkout-session.mjs (it always sets
        // this from the authenticated session), but don't silently drop
        // real money if it ever does - it's visible in the Vercel logs.
        console.warn(`[stripe-webhook] paid session ${s.id} has no client_reference_id - cannot credit any wallet`);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      console.log(`[stripe-webhook] ${event.type} id=${sub.id} status=${sub.status}`);
      break;
    }
    default:
      console.log(`[stripe-webhook] unhandled event type: ${event.type}`);
  }

  // Ack fast — Stripe retries (with backoff) if it doesn't get a 2xx quickly.
  return res.status(200).json({ received: true });
}
