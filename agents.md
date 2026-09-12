# agents.md — Naano rebuild agent roster

> **Status: staged, not active.** Screen inventory + change-impact graph live in `docs/naano-notes.md`.
> Activate agents only on explicit go-ahead. Goal today is document & map.

## Ground rules for every agent
- Single source of truth: `docs/naano-notes.md` (§5 inventory, §6 change-impact graph).
- Only touch the files / screen-IDs in your **Scope**. If a change would hit another agent's scope
  per §6, log it in `docs/naano-notes.md` §8 instead of reaching across.
- Match existing conventions in `index.html` (single-file page, "enhancement layer" CSS after a
  minified base, kebab/BEM-ish classes, `https://naano.com/lp/*` CDN assets). No build step, no
  framework unless the spec says so.
- Deliver: updated files + a row in `docs/naano-notes.md` §7 (Change log).
- High blast radius (see §6): `design tokens`, `cmp:MarketplaceCard`, `cmp:AppShell`. Changes there
  require a QA pass across all dependents.

## Wave 0 — foundation (blocks everything)
### agent:tokens-and-primitives
- **Scope:** `docs/design-system.md` + a primitives showcase page.
  Tokens (colour/type/space/radius/shadow/motion from §4.1) and primitives from §4.3:
  Button, OAuthButton, Input/PasswordInput, Select, ChipGroup, RadioCard, Card, KpiTile/StatTile,
  ProgressBar, Badge/Pill, Tabs, DataTable(+empty+pager), Avatar, Banner, CoachMark,
  LeaderboardRow, BarChart, **MarketplaceCard (+flip)**, AppShell (rail+topbar+assistant), AuthSplit.
- **Inputs:** §4, design screenshots, live-app CSS if reachable.
- **Blocks:** every screen agent.

## Wave 1 — screen agents (parallel, after Wave 0)
### agent:auth
- **Scope / IDs:** `AUTH-01` (sign in), `AUTH-02` (role picker). OAuth hand-off is external.
- **Deps:** AuthSplit, OAuthButton, Input/PasswordInput, RadioCard.

### agent:onboarding
- **Scope / IDs:** `ONB-01`…`ONB-06` (4 steps + optional business step + card reveal).
- **Deps:** MarketplaceCard (live-preview rail), Select, ChipGroup, RadioCard, Banner, Input.
- **Note:** the right-rail card must visibly fill in across steps.

### agent:workspace-shell-and-overview
- **Scope / IDs:** `cmp:AppShell` integration, `CRW-01` (Overview), `CRW-10` (Settings/Integrations — layout TBD), guided-tour framework.
- **Deps:** AppShell, KpiTile, MarketplaceCard, DataTable, Badge, CoachMark.

### agent:my-card
- **Scope / IDs:** `CRW-02` (My card / Creator storefront), Edit/Preview, Deal-Link block.
- **Deps:** MarketplaceCard, Card, Button.

### agent:opportunities-collaborations
- **Scope / IDs:** `CRW-03` (Opportunities, incl. locked gate), `CRW-04` (Collaborations, tabs+table). Unlocked list & detail = TBD, flag in §8.
- **Deps:** Banner, Tabs, DataTable.

### agent:analytics
- **Scope / IDs:** `CRW-05` (Analytics, "import in progress" state).
- **Deps:** KpiTile, Card, (BarChart later for data state).

### agent:community
- **Scope / IDs:** `CRW-06` (Slack + LinkedIn-visibility + campaign leaderboard).
- **Deps:** Card, LeaderboardRow, Avatar.

### agent:earnings
- **Scope / IDs:** `CRW-07` (tiles, 6-month bar chart, withdraw w/ Stripe+bank, recent activity).
- **Deps:** BarChart, RadioCard, Tabs, DataTable, Input.

### agent:affiliate-messages
- **Scope / IDs:** `CRW-08` (Affiliate — re-sample frames 3:04–3:10 first), `CRW-09` (Messages).
- **Deps:** Card, list/thread primitives.

### agent:marketing-polish
- **Scope / IDs:** `index.html` + `pages/*` (`MKT-*`). Reconcile against §2 (0:00–0:54).

### agent:brand-side  *(partially unblocked 2026-09-13)*
- **Scope / IDs:** `BRD-01` (marketplace grid, design #2) + everything brand.
- First brand walkthrough landed 2026-09-13 — see `docs/naano-notes.md` §7/§8. Built so far: the website-scrape onboarding step (`onboarding-company-website.html` + `api/scrape-company.mjs`) and Billing/Stripe (`billing.html` + `api/create-checkout-session.mjs` + `api/checkout-session.mjs`).
- Still open / not built: brand Overview dashboard, campaign-launch picker, AI creator-finder chat, `All creators` grid, brand-side Collaborations, and a brand `cmp:AppShell` rail (current rail is creator-only) — re-sample the video for these before building.

## Coordination
- **Order:** Wave 0 → Wave 1 in parallel → `agent:qa`.
- **agent:qa** — after each wave: verify each screen against its §5 block and the §6 graph; log gaps in §8; keep §7 change log current.
