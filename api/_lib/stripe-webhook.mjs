/* Stripe webhook signature verification — pure node:crypto, no dependency,
 * and notably NO call to Stripe's API (so this works with only
 * STRIPE_WEBHOOK_SECRET; the separate STRIPE_SECRET_KEY isn't needed here).
 *
 * Implements Stripe's documented scheme exactly:
 *   header "Stripe-Signature: t=<unix-ts>,v1=<hex-hmac>[,v0=...]"
 *   expected = HMAC-SHA256(secret, `${t}.${rawBody}`)  (hex)
 *   compare `v1` to `expected` in constant time, then check `t` isn't stale
 *   (defends against a captured request being replayed later).
 *
 * The raw, unparsed request body is required — Stripe signs the exact bytes
 * it sent, not a re-serialized JSON.stringify of them. Callers must read the
 * body as text/Buffer BEFORE any JSON parsing happens.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300; // Stripe's own default

export class SignatureVerificationError extends Error {}

function parseSigHeader(header) {
  const parts = {};
  for (const kv of String(header || "").split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k] = v;
  }
  return parts;
}

/** Returns the parsed event object if (and only if) the signature is valid. */
export function verifyStripeSignature(rawBody, sigHeader, secret, { toleranceSeconds = DEFAULT_TOLERANCE_SECONDS } = {}) {
  if (!secret) throw new SignatureVerificationError("STRIPE_WEBHOOK_SECRET not set.");
  const { t: timestamp, v1 } = parseSigHeader(sigHeader);
  if (!timestamp || !v1) throw new SignatureVerificationError("Missing or malformed Stripe-Signature header.");

  const expectedHex = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");

  let expectedBuf, actualBuf;
  try {
    expectedBuf = Buffer.from(expectedHex, "hex");
    actualBuf = Buffer.from(v1, "hex");
  } catch {
    throw new SignatureVerificationError("Signature header is not valid hex.");
  }
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new SignatureVerificationError("Signature mismatch — wrong webhook secret, or the payload was altered in transit.");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > toleranceSeconds) {
    throw new SignatureVerificationError(`Timestamp is ${Math.round(ageSeconds)}s old (tolerance ${toleranceSeconds}s) — possible replay.`);
  }

  return JSON.parse(rawBody);
}
