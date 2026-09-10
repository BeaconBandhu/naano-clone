# Naano Clone

High-fidelity practice clone of Naano.com — marketing site + the creator-side app,
recovered from a walkthrough video + design screenshots (see `docs/naano-notes.md`).

```
index.html            marketing site
pages/*.html           marketing sub-pages
app/*.html             creator app (auth, onboarding, workspace) + marketplace grid
app/app.css|app.js      shared design system + all interactions
api/evaluate.mjs        serverless function: LinkedIn + X scrape → Marketplace card
api/_lib/scrape.mjs     the scrape/score/evaluate logic (shared by the function & the dev server)
server/serve.mjs        local dev server (static + /api/evaluate, same code as the function)
```

## Run locally

```bash
npm run dev          # → http://localhost:5173   (or: node server/serve.mjs)
```

No dependencies. Open <http://localhost:5173>, click any **Sign in / Sign up**
button → the *Connect your accounts* modal asks for a **LinkedIn** and **X**
profile link, scrapes **bio + recent posts + audience**, and evaluates them onto
the Marketplace card (name, headline, industries, followers, est. impressions,
€/post, engagement, presence score, ICP). The card is stored in `localStorage`
and shows on every screen; a chip on each page lets you **Re-analyze**.

### Apify token (live LinkedIn)

`GET /api/evaluate` reports whether a token is set.

- **Live scrape** of any profile needs an Apify token — `copy .env.example .env`
  and set `APIFY_TOKEN=…`, or paste one in the modal's *Advanced* box.
- **Without a token**, `/in/aranyabandhu/` uses the bundled sample scrape
  (`api/_lib/sample-linkedin.mjs`); other profiles return a note and the card
  still builds from X + demo values.
- X (fxtwitter) needs no key. "Last 5 X posts" needs the post links (paste them
  under *Advanced*) — fxtwitter has no timeline endpoint.

## Deploy to Vercel

Zero-config: static files at the root + the function in `api/`.

```bash
# 1. push to GitHub
git init && git add . && git commit -m "naano clone"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main

# 2. import the repo at https://vercel.com/new   (Framework preset: "Other")

# 3. add the env var (Project → Settings → Environment Variables)
APIFY_TOKEN = apify_api_xxx
```

That's it — `/` serves the marketing site, `/app/*` the app, and `/api/evaluate`
runs as a Node function (`maxDuration: 60` in `vercel.json`). The dev server, the
Python `Test Linkedin` CLI, `docs/`, and `scripts/` are excluded via
`.vercelignore`.

If the function isn't deployed or the token is missing, the connect modal says so
and the app keeps working on demo data.

## Note

A functional visual clone, not a copy of Naano's private source, backend or
authenticated product. Automated scraping is against LinkedIn's / X's terms — the
scrapers here run against profiles **you** enter, for a personal project.
