# Real backend: database, auth, wallet, creators, campaigns

Before this, almost the entire logged-in experience was either static HTML,
a hardcoded array, or `localStorage` — sign in/create account made zero
backend calls, the marketplace grid was a hardcoded `CR=[...]`, the brand
dashboard's nav items were `href="#"`, and the wallet balance lived only in
the visitor's own browser. This replaces all of that with a real database
and real API endpoints — no mock data, no hardcoded responses.

## Database: SQLite via `node:sqlite` — zero dependencies

Node 22.5+ ships a built-in SQLite driver (`node:sqlite`, stable, no flag
needed on the Node 24+ this repo already requires). No npm package — the
same "plain APIs, no SDK" convention already used for Stripe/OpenAI/Apify,
one layer further down: even the database driver is something Node ships,
not something installed.

- **Schema**: [`db/schema.sql`](db/schema.sql) — `profiles`, `sessions`,
  `creator_cards`, `brand_profiles`, `campaigns`, `collaborations`,
  `wallet_ledger`. Applied automatically on first connection.
- **Access**: [`api/_lib/db.mjs`](api/_lib/db.mjs) — every other backend
  file talks to `get`/`all`/`run`/`transaction` from this one module, never
  to `node:sqlite` directly. That's deliberate: swapping to a hosted
  SQLite-compatible store for a real deployment is a change to this one
  file, not a rewrite of the backend.

**The one real limitation, stated plainly**: this works, and is fully
persistent, for local dev or a self-hosted deploy with a real filesystem.
It does **not** reliably persist on Vercel — Vercel's filesystem is
read-only outside `/tmp`, and `/tmp` is wiped between invocations and not
shared across concurrent instances. `db.mjs` detects `process.env.VERCEL`
and writes to `/tmp` there so it doesn't crash, but data won't survive
between requests in that environment. Swapping in a hosted database
(Turso/libSQL is SQLite-wire-compatible, or Supabase/Neon Postgres with
minor query changes) is the one step needed to make this durable on
Vercel — deliberately left as the last, smallest possible piece of "my
part", since it needs an external account this session can't create.

## Auth — hand-rolled, zero dependency

[`api/_lib/auth.mjs`](api/_lib/auth.mjs): `node:crypto`'s `scrypt` for
password hashing (no bcrypt/argon2 package), a random opaque token in the
`sessions` table for the session itself (no JWT library) — logout is a real
`DELETE`, not "wait for a client-side token to expire".

- `POST /api/auth/signup` — `{ email, password, role: "creator"|"brand", name? }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/session` — `{ user }` or `{ user: null }`

All four set/clear an httpOnly `naano_session` cookie. Wired into
`app/signin.html` and `app/create-account.html` (which now also collects
name/email/password — it never did before) and `app/app.js` /
`app/brand.js`'s "Sign out" links.

OAuth ("Continue with LinkedIn/Google") buttons are left as they were —
inert. Making those real needs registering OAuth apps with LinkedIn/Google
(client ID + secret, another external-account step), not a code change.

## Wallet — the exact gap the webhook code already flagged, now closed

`api/webhooks/stripe.mjs` could verify a real signed Stripe event but had
nowhere server-side to persist "this got paid" (a comment saying exactly
that has been in this file since it was first written). Now it does:

1. `api/create-checkout-session.mjs` requires a real session and passes the
   logged-in user's id as `client_reference_id` to Stripe.
2. `api/webhooks/stripe.mjs`, on `checkout.session.completed`, credits
   `wallet_ledger` for that id. **Idempotent** — `stripe_session_id` is
   `UNIQUE`, so a Stripe retry (it retries anything but a fast 2xx) can't
   double-credit; verified live with a genuinely HMAC-signed event sent
   twice.
3. `GET /api/wallet` returns the real balance (`SUM(amount_cents)`) and
   ledger for the signed-in brand.
4. `app/billing.html` reads/shows this instead of `localStorage`, and
   redirects to sign-in if not authenticated.

## Creators, profiles, campaigns, collaborations

- `GET /api/creators` — real signups, replacing `marketplace.html`'s old
  hardcoded six-entry array. An empty list on a fresh database is the
  correct answer, not a bug — `marketplace.html` shows a real empty state.
- `GET/PUT /api/profile` — the creator card / brand profile, persisted per
  account instead of in `localStorage["naano.card"]` (creator) or
  `sessionStorage["naano_brand_profile"]` (brand onboarding).
- `GET/POST /api/campaigns`, `GET/POST/PATCH /api/collaborations` — back the
  brand dashboard's Campaigns/Collaborations nav items, previously
  `href="#"` with nothing behind them. Role- and ownership-checked (a brand
  can't invite into another brand's campaign; a creator can't create one).

## Verified live, this session

Real signup (+ duplicate-email 409, wrong-password 401), profile
persistence, the creators list reflecting a real signup, campaign
creation + role gating, a genuinely HMAC-signed Stripe webhook event
crediting the real wallet, a retry of that same event not double-crediting,
and logout actually invalidating the session server-side (`/api/wallet`
returns 401 immediately after).

## Not done here

- Frontend for campaigns/collaborations (list/detail UI) — the API exists,
  the pages weren't rebuilt to call it yet.
- Real OAuth (LinkedIn/Google sign-in) — needs registering apps with each
  provider.
- A hosted database for the Vercel deployment specifically (see above).
