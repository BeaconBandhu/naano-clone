# Website chat widget

A floating "What can I help you find?" widget (`naano-chat-widget.js`,
included on `index.html` and `pages/*.html`) that answers questions about
Naano **grounded strictly in this site's own content** — it refuses
anything the site doesn't cover, rather than answering as a general
assistant. That's a deliberate fix: the real naano.com's own floating
assistant does *not* do this (verified live: asked it to write Python file
I/O code and solve an array problem, and it just did, with no relation to
the product).

## Backend: native to this repo (`api/ask.mjs` → `api/_lib/rag.mjs`)

**This changed.** The widget originally called out to a separate Python
project (FAISS + Sentence-Transformers + torch, run as its own server) — see
`docs/naano-notes.md`'s chatbot changelog entries for that history. It
worked, but doesn't fit a Vercel deploy: `torch` alone is ~550MB (past the
~250MB serverless function limit), `sentence-transformers` needs it just to
embed a query, and the FAISS index needs a persistent disk a serverless
function doesn't have.

This version drops all of that and lives entirely in this repo, matching
how `api/_lib/stripe.mjs` and `api/_lib/scrape.mjs` already talk to their
respective APIs — plain REST over `fetch`, no SDK:

- **Retrieval** — `api/_lib/rag-index.json`, a small precomputed
  `{text, source, embedding}` array (~53 chunks from this site's 5 public
  pages). Searched with brute-force cosine similarity in plain JS
  (`api/_lib/rag.mjs`) — at this corpus size an ANN index (FAISS/HNSW) buys
  nothing over a linear scan, so it isn't needed.
- **Embedding** — OpenAI's `text-embedding-3-small` via `POST
  /v1/embeddings`, both for indexing (`scripts/build-rag-index.mjs`) and for
  each query at ask-time.
- **Generation** — OpenAI's `gpt-5.4-mini` via `POST /v1/chat/completions`,
  with a system prompt that mirrors the old project's strict-grounding
  contract: answer only from the retrieved chunks, cite the source filename,
  or say plainly the documents don't cover it.
- **Relevance gate** — same idea as the old project's `MIN_RELEVANCE_SCORE`
  (`0.3`): a nearest-neighbor search always returns *something*, even when
  nothing in the corpus is actually relevant. Below the threshold, skip the
  LLM call entirely and answer "not in the documents" directly.

### Setup

```
# .env (gitignored) — see .env.example
OPENAI_API_KEY=sk-...
```

That's it — no separate server, no venv, no GPU. `npm run dev` (or a Vercel
deploy) picks it up automatically; `server/serve.mjs` loads `.env` the same
way it already does for `APIFY_TOKEN`/`STRIPE_SECRET_KEY`, and routes
`POST /api/ask` to the same `api/_lib/rag.mjs` code Vercel's `api/ask.mjs`
uses — local behaves like deployed, same pattern as every other endpoint in
this repo.

### Rebuilding the index

```
node scripts/build-rag-index.mjs
```

Requires the local dev server running (re-fetches the 5 pages from it) and
`OPENAI_API_KEY` set. Not automatic — run it again any time the marketing
copy changes materially, same caveat the old setup had.

The widget calls same-origin `/api/ask` by default. To point it at a
different deployment instead, set `window.NAANO_CHAT_API = "https://..."`
in an inline `<script>` **before** `naano-chat-widget.js` loads.

## Why answers get refused so often in testing

This site's indexed content is currently just 5 marketing pages (~53
chunks), so anything not covered by the homepage / creators / agencies /
blog / register pages correctly comes back as "The provided documents don't
contain information about this." That's the guardrail working, not a bug.
Widen the corpus by adding more pages to `PAGES` in
`scripts/build-rag-index.mjs` and re-running it.

## Not done here

- The widget isn't wired into `app/*.html` (the logged-in creator/brand
  workspace) — only the public marketing pages, matching where the
  reference screenshots showed it.
- No conversation memory across questions — each query is answered
  independently (no chat history sent back to `/api/ask`).
- The standalone Python/FAISS project this superseded still exists
  (`github.com/BeaconBandhu/faiss-rag-dashboard`, mirrored to
  `github.com/Vanshhikaa04/faiss-rag-dashboard`) as a separate, more
  general-purpose RAG tool — it's just no longer what this widget calls.
