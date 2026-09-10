# server/ — local dev server

```bash
node server/serve.mjs        # → http://localhost:5173
```

Static hosting for the repo + `POST /api/evaluate`. It runs the **same**
`runEvaluate()` from `api/_lib/scrape.mjs` that the Vercel function
(`api/evaluate.mjs`) uses, so local behaves like the deployment.

- `APIFY_TOKEN` — read from the environment or a repo-root `.env` (parsed here
  without a dependency). Enables live LinkedIn scraping; without it,
  `/in/aranyabandhu/` uses `api/_lib/sample-linkedin.mjs`.
- This folder is in `.vercelignore` — it is not part of the deployment.
- The standalone `C:\Users\User\Videos\Test Linkedin` Python CLI still works on
  its own, but the web app no longer shells out to it (Vercel can't). The REST
  path hits the same HarvestAPI actors.

See the root `README.md` for the full picture and Vercel deploy steps.
