/* Real creator directory, backed by creator_cards + profiles.
 * Replaces marketplace.html's old hardcoded `CR = [...]` array.
 */
import { all } from "./db.mjs";

export function listCreators({ limit = 50 } = {}) {
  const rows = all(
    `SELECT p.id, p.name, c.headline, c.country, c.industries,
            c.price_per_post_cents, c.followers, c.linkedin_url
     FROM creator_cards c
     JOIN profiles p ON p.id = c.profile_id
     ORDER BY c.updated_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name || "Unnamed creator",
    headline: r.headline || null,
    country: r.country || null,
    industries: safeJsonArray(r.industries),
    pricePerPostCents: r.price_per_post_cents || 0,
    followers: r.followers ?? null,
    linkedinUrl: r.linkedin_url || null,
  }));
}

function safeJsonArray(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
