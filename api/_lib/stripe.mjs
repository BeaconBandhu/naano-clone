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

/* Fixed Price IDs created in the Stripe sandbox dashboard, one env var each.
 * `mode` must match how each Price was created in Stripe (one-time vs
 * recurring) — get this wrong and Stripe rejects the session outright. Wallet
 * top-ups are one-time; Starter/Pro/Business are monthly plans, so "subscription". */
export const PRICE_CATALOG = {
  topup_100: { env: "STRIPE_PRICE_TOPUP_100", mode: "payment", label: "€100 top-up" },
  topup_200: { env: "STRIPE_PRICE_TOPUP_200", mode: "payment", label: "€200 top-up" },
  topup_300: { env: "STRIPE_PRICE_TOPUP_300", mode: "payment", label: "€300 top-up" },
  starter: { env: "STRIPE_PRICE_STARTER", mode: "subscription", label: "Starter plan" },
  pro: { env: "STRIPE_PRICE_PRO", mode: "subscription", label: "Pro plan" },
  business: { env: "STRIPE_PRICE_BUSINESS", mode: "subscription", label: "Business plan" },
};

export function resolvePlan(key) {
  const entry = PRICE_CATALOG[key];
  if (!entry) {
    throw Object.assign(
      new Error(`Unknown plan key "${key}". Valid: ${Object.keys(PRICE_CATALOG).join(", ")}`),
      { status: 400 }
    );
  }
  const priceId = process.env[entry.env];
  if (!priceId) {
    throw Object.assign(new Error(`${entry.env} not set — add it to .env.`), { status: 400 });
  }
  return { priceId, mode: entry.mode, label: entry.label };
}

/** Create a hosted Checkout Session (full-page redirect, "Powered by Stripe").
 *
 * Pass ONE of:
 *   - `plan`: a PRICE_CATALOG key ("topup_100", "pro", ...) — preferred, uses
 *     the real Price object created in the Stripe dashboard.
 *   - `priceId` (+ optional `mode`, default "payment") — a raw Stripe Price ID.
 *   - `amountCents` (+ optional `currency`, `description`) — ad-hoc one-time
 *     amount for a custom top-up that doesn't match a preset tier. Stripe
 *     creates the Price on the fly; it won't show up as a saved Product.
 */
export async function createCheckoutSession({
  plan,
  priceId,
  mode,
  amountCents,
  currency = "eur",
  description = "Naano wallet top-up",
  successUrl,
  cancelUrl,
  customerEmail,
}) {
  if (!successUrl || !cancelUrl) {
    throw Object.assign(new Error("successUrl and cancelUrl are required."), { status: 400 });
  }

  let lineItem, sessionMode;
  if (plan) {
    const resolved = resolvePlan(plan);
    lineItem = { price: resolved.priceId, quantity: 1 };
    sessionMode = resolved.mode;
  } else if (priceId) {
    lineItem = { price: priceId, quantity: 1 };
    sessionMode = mode || "payment";
  } else if (Number.isFinite(amountCents) && amountCents >= 100) {
    lineItem = {
      price_data: { currency, product_data: { name: description }, unit_amount: Math.round(amountCents) },
      quantity: 1,
    };
    sessionMode = "payment";
  } else {
    throw Object.assign(
      new Error("Provide `plan` (catalog key), `priceId`, or `amountCents` (>= 100)."),
      { status: 400 }
    );
  }

  return stripeRequest("/checkout/sessions", {
    method: "POST",
    body: {
      mode: sessionMode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      line_items: [lineItem],
    },
  });
}

/** Confirm a session after the customer is redirected back (?session_id=...). */
export async function retrieveCheckoutSession(sessionId) {
  if (!sessionId) throw Object.assign(new Error("missing session id"), { status: 400 });
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
