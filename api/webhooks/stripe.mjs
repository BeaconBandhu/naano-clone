/* Vercel serverless function — POST /api/webhooks/stripe
 * Stripe's servers call this directly (never the browser) the moment a
 * checkout / subscription event happens. Verified with STRIPE_WEBHOOK_SECRET
 * via pure HMAC (api/_lib/stripe-webhook.mjs) — no Stripe API call, so this
 * endpoint works even without STRIPE_SECRET_KEY set.
 *
 * IMPORTANT — this repo has no database (see docs/naano-notes.md). This
 * handler does the real, production-shaped thing: verify the signature,
 * then act on the event. But "act on" currently just logs, because there is
 * nowhere server-side yet to persist "this got paid" or "this idempotency
 * key was already processed". The wallet balance in billing.html is still
 * credited via the client polling /api/checkout-session on redirect-back —
 * that is a demo stand-in, not this webhook. Once a real datastore exists,
 * replace the console.log below with a write (keyed on event.id for
 * idempotency, since Stripe retries webhooks and can send duplicates).
 */
import { SignatureVerificationError, verifyStripeSignature } from "../_lib/stripe-webhook.mjs";

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
          `customer_email=${s.customer_details?.email || "n/a"}`
      );
      // TODO once a datastore exists: idempotently credit the wallet /
      // activate the plan for s.customer_email (or s.client_reference_id),
      // keyed on event.id so a Stripe retry doesn't double-credit.
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
