/* Tiny shared helper - every api/*.mjs handler in this repo re-reads the
 * request body the same way (Vercel sometimes hands it over pre-parsed,
 * sometimes as a raw stream depending on runtime); this just avoids
 * repeating that block verbatim in every new file added here. */
export async function readJsonBody(req) {
  let body = req.body;
  if (body == null || typeof body === "string") {
    let raw = typeof body === "string" ? body : "";
    if (!raw) {
      for await (const chunk of req) raw += chunk;
    }
    body = raw ? JSON.parse(raw) : {};
  }
  return body || {};
}
