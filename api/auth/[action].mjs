/* Vercel serverless function — /api/auth/{signup,login,logout,session}
 * One file instead of four: Vercel's Hobby plan caps a deployment at 12
 * serverless functions, and this project has grown past that counting them
 * one-per-file. Vercel's `[param]` bracket syntax makes this a single
 * dynamic route matching all four paths, dispatching on `action` — same
 * behavior and same URLs as before, just one function instead of four.
 * (server/serve.mjs mirrors this dispatch for local dev, since raw
 * node:http doesn't have bracket-route parsing built in.)
 */
import { login, signup } from "../_lib/accounts.mjs";
import { clearCookieHeader, destroySession, getSessionUser, sessionCookieHeader } from "../_lib/auth.mjs";
import { readJsonBody } from "../_lib/http.mjs";

export default async function handler(req, res) {
  const action = req.query?.action || req.url.split("?")[0].split("/").filter(Boolean).pop();

  try {
    switch (action) {
      case "signup": {
        if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
        const body = await readJsonBody(req);
        const { user, sessionToken } = signup(body);
        res.setHeader("Set-Cookie", sessionCookieHeader(sessionToken));
        return res.status(200).json({ user });
      }
      case "login": {
        if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
        const body = await readJsonBody(req);
        const { user, sessionToken } = login(body);
        res.setHeader("Set-Cookie", sessionCookieHeader(sessionToken));
        return res.status(200).json({ user });
      }
      case "logout": {
        if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
        destroySession(req);
        res.setHeader("Set-Cookie", clearCookieHeader());
        return res.status(200).json({ ok: true });
      }
      case "session": {
        if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
        res.setHeader("cache-control", "no-store");
        return res.status(200).json({ user: getSessionUser(req) });
      }
      default:
        return res.status(404).json({ error: `Unknown auth action "${action}".` });
    }
  } catch (e) {
    return res.status(e?.status || 500).json({ error: String(e?.message || e) });
  }
}
