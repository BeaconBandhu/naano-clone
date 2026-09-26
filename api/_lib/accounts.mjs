/* Signup / login business logic, shared by the Vercel handlers
 * (api/auth/*.mjs) and the local dev server (server/serve.mjs) - same
 * pattern as api/_lib/scrape-company.mjs and api/_lib/stripe.mjs.
 */
import { randomUUID } from "node:crypto";
import { get, run, transaction } from "./db.mjs";
import { createSession, hashPassword, verifyPassword } from "./auth.mjs";

function publicUser(row) {
  return { id: row.id, email: row.email, role: row.role, name: row.name };
}

export function signup({ email, password, role, name }) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");
  name = name ? String(name).trim() : null;

  if (!email || !email.includes("@")) {
    throw Object.assign(new Error("A valid email is required."), { status: 400 });
  }
  if (password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters."), { status: 400 });
  }
  if (role !== "creator" && role !== "brand") {
    throw Object.assign(new Error('role must be "creator" or "brand".'), { status: 400 });
  }
  if (get("SELECT id FROM profiles WHERE email = ?", [email])) {
    throw Object.assign(new Error("An account with this email already exists."), { status: 409 });
  }

  const id = randomUUID();
  transaction(() => {
    run("INSERT INTO profiles (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)", [
      id,
      email,
      hashPassword(password),
      role,
      name,
    ]);
    if (role === "creator") run("INSERT INTO creator_cards (profile_id) VALUES (?)", [id]);
    else run("INSERT INTO brand_profiles (profile_id) VALUES (?)", [id]);
  });

  const user = { id, email, role, name };
  return { user, sessionToken: createSession(id) };
}

export function login({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  const row = get("SELECT * FROM profiles WHERE email = ?", [email]);
  if (!row || !verifyPassword(String(password || ""), row.password_hash)) {
    // Same message for "no such user" and "wrong password" - don't leak
    // which one it was.
    throw Object.assign(new Error("Invalid email or password."), { status: 401 });
  }
  return { user: publicUser(row), sessionToken: createSession(row.id) };
}
