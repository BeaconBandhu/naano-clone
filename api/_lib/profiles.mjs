/* Real creator-card / brand-profile persistence.
 * Replaces app.js's localStorage["naano.card"] (creator side) and the
 * brand-onboarding flow's sessionStorage["naano_brand_profile"] — both were
 * per-browser only; this is per-account, in the database.
 */
import { get, run } from "./db.mjs";

export function getProfile(user) {
  if (user.role === "creator") {
    const card = get("SELECT * FROM creator_cards WHERE profile_id = ?", [user.id]) || {};
    return {
      id: user.id,
      role: "creator",
      name: user.name,
      email: user.email,
      headline: card.headline || null,
      country: card.country || null,
      industries: safeJsonArray(card.industries),
      pricePerPostCents: card.price_per_post_cents || 0,
      followers: card.followers ?? null,
      linkedinUrl: card.linkedin_url || null,
    };
  }
  const brand = get("SELECT * FROM brand_profiles WHERE profile_id = ?", [user.id]) || {};
  return {
    id: user.id,
    role: "brand",
    name: user.name,
    email: user.email,
    companyName: brand.company_name || null,
    domain: brand.domain || null,
    valueProp: brand.value_prop || null,
    icps: safeJsonArray(brand.icps),
  };
}

export function updateCreatorCard(userId, patch) {
  const current = get("SELECT * FROM creator_cards WHERE profile_id = ?", [userId]);
  if (!current) throw Object.assign(new Error("Not a creator account."), { status: 403 });
  run(
    `UPDATE creator_cards SET
       headline = ?, country = ?, industries = ?, price_per_post_cents = ?,
       followers = ?, linkedin_url = ?, updated_at = datetime('now')
     WHERE profile_id = ?`,
    [
      patch.headline ?? current.headline,
      patch.country ?? current.country,
      patch.industries ? JSON.stringify(patch.industries) : current.industries,
      patch.pricePerPostCents ?? current.price_per_post_cents,
      patch.followers ?? current.followers,
      patch.linkedinUrl ?? current.linkedin_url,
      userId,
    ]
  );
}

export function updateBrandProfile(userId, patch) {
  const current = get("SELECT * FROM brand_profiles WHERE profile_id = ?", [userId]);
  if (!current) throw Object.assign(new Error("Not a brand account."), { status: 403 });
  run(
    `UPDATE brand_profiles SET
       company_name = ?, domain = ?, value_prop = ?, icps = ?, updated_at = datetime('now')
     WHERE profile_id = ?`,
    [
      patch.companyName ?? current.company_name,
      patch.domain ?? current.domain,
      patch.valueProp ?? current.value_prop,
      patch.icps ? JSON.stringify(patch.icps) : current.icps,
      userId,
    ]
  );
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
