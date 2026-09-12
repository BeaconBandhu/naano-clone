/* Stripe via raw REST + fetch — no `stripe` npm package, matching this
 * repo's zero-dependency convention. Stripe's API is plain
 * application/x-www-form-urlencoded with bracket-notation for nested params,
 * so a small form-encoder is all that's needed.
 *
 * Uses STRIPE_SECRET_KEY (test mode: sk_test_...). Get one from your Stripe
 * Dashboard → Developers → API keys, with "Test mode" toggled on (sandbox).
 * Powers the brand Billing "Add budget" → hosted Stripe Checkout flow.
 */

const STRIPE_API = "https://api.stripe.com/v1";

function flatten(value, prefix = "", out = {}) {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out[prefix] = String(value);
  }
  return out;
}

function formBody(obj) {
  const flat = flatten(obj);
  return Object.entries(flat)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function requireKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw Object.assign(
      new Error("STRIPE_SECRET_KEY not set. Add a TEST-mode key (sk_test_...) to .env locally, or the Vercel project's Environment Variables."),
      { status: 400 }
    );
  }
  if (!key.startsWith("sk_test_")) {
    // Not a hard failure (some sandboxes issue differently-prefixed restricted keys),
    // but this app is sandbox-only, so a live key is almost certainly a mistake.
    console.warn("[stripe] STRIPE_SECRET_KEY does not start with sk_test_ — make sure this is a TEST/sandbox key.");
  }
  return key;
}

async function stripeRequest(path, { method = "GET", body } = {}) {
  const key = requireKey();
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? formBody(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message || `Stripe API error (HTTP ${res.status})`), {
      status: res.status,
      code: json?.error?.code,
    });
  }
  return json;
}

/** Create a hosted Checkout Session (full-page redirect, "Powered by Stripe"). */
export async function createCheckoutSession({
  amountCents,
  currency = "eur",
  description = "Naano wallet top-up",
  successUrl,
  cancelUrl,
  customerEmail,
}) {
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    throw Object.assign(new Error("amountCents must be a number >= 100 (minimum charge is 1.00)."), { status: 400 });
  }
  if (!successUrl || !cancelUrl) {
    throw Object.assign(new Error("successUrl and cancelUrl are required."), { status: 400 });
  }
  return stripeRequest("/checkout/sessions", {
    method: "POST",
    body: {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description },
            unit_amount: Math.round(amountCents),
          },
          quantity: 1,
        },
      ],
    },
  });
}

/** Confirm a session after the customer is redirected back (?session_id=...). */
export async function retrieveCheckoutSession(sessionId) {
  if (!sessionId) throw Object.assign(new Error("missing session id"), { status: 400 });
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
