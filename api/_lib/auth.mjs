/* Session auth — hand-rolled, zero dependency (node:crypto's scrypt for
 * password hashing, a random token in a `sessions` table for the session
 * itself). No JWT library, no bcrypt/argon2 package: scrypt is built into
 * Node and is a fine password KDF; a DB-backed opaque token (rather than a
 * signed/stateless one) means logout and expiry are a real DELETE, not
 * "wait for the token to expire client-side".
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { get, run } from "./db.mjs";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const COOKIE_NAME = "naano_session";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function createSession(profileId) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  run("INSERT INTO sessions (id, profile_id, expires_at) VALUES (?, ?, ?)", [id, profileId, expiresAt]);
  return id;
}

export function sessionCookieHeader(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

/** Returns the logged-in {id, email, role, name}, or null. Never throws. */
export function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  return (
    get(
      `SELECT p.id, p.email, p.role, p.name FROM sessions s
       JOIN profiles p ON p.id = s.profile_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
      [token]
    ) || null
  );
}

/** Throws a 401 (with the shape api handlers already expect) if not logged in. */
export function requireSessionUser(req) {
  const user = getSessionUser(req);
  if (!user) throw Object.assign(new Error("Not signed in."), { status: 401 });
  return user;
}

export function destroySession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (token) run("DELETE FROM sessions WHERE id = ?", [token]);
}
