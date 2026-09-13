# Website chat widget

A floating "What can I help you find?" widget (`naano-chat-widget.js`,
included on `index.html` and `pages/*.html`) that answers questions about
Naano **grounded strictly in this site's own content** — it refuses
anything the site doesn't cover, rather than answering as a general
assistant. That's a deliberate fix: the real naano.com's own floating
assistant does *not* do this (verified live: asked it to write Python file
I/O code and solve an array problem, and it just did, with no relation to
the product).

## Backend: a separate project, run alongside this one

The widget calls a RAG (retrieval-augmented generation) server that isn't
part of this repo — it's a general-purpose local RAG tool (FAISS +
Sentence-Transformers retrieval, OpenAI-generated answers) living at
`C:\Users\User\Pictures\RAG` on this machine. Two small changes were made
there to support this integration cleanly:

- **CORS** (`app/server.py`) — the dashboard never needed cross-origin
  requests; a separate site embedding it as a widget does.
- **Encoding fix** (`app/documents.py`) — `requests` silently defaults to
  ISO-8859-1 for any fetched page with no declared charset, which was
  mangling this repo's UTF-8 ("€" → "â¬"). Fixed alongside it here:
  `server/serve.mjs` now declares `charset=utf-8` explicitly, which any
  real browser already inferred correctly (via `<meta charset>`) but a
  charset-respecting HTTP client like `requests` did not.
- **`RAG_INDEX_DIR` / `RAG_GENERATION_BACKEND` env overrides** — that
  project already had an unrelated demo corpus indexed (a NeurIPS paper, a
  Wikipedia article, etc.). Mixing that into a "this site only" corpus
  would have let off-topic questions come back "grounded" against
  *that* content instead — the opposite of the point. These overrides
  point this integration at its own index and its own generation backend
  without touching that project's own defaults.

### Running it

```powershell
cd C:\Users\User\Pictures\RAG
$env:RAG_INDEX_DIR = "C:\Users\User\Pictures\RAG\index_naano_website"
$env:RAG_GENERATION_BACKEND = "openai"    # reliable; needs OPENAI_API_KEY in that project's .env
./.venv/Scripts/python.exe -m uvicorn app.server:app --host 0.0.0.0 --port 8000
```

Then, with this repo's own dev server also running (`npm run dev`, port
5173), index this site's public pages once (repeat any time the marketing
copy changes materially — it's not automatic):

```powershell
foreach ($p in "", "pages/creators.html", "pages/agencies.html", "pages/blog.html", "pages/register.html") {
  curl.exe -s -X POST http://127.0.0.1:8000/api/documents -F "link=http://localhost:5173/$p" | Out-Null
}
```

The widget defaults to `http://localhost:8000`. To point it elsewhere
(a deployed RAG server), set `window.NAANO_CHAT_API = "https://..."` in an
inline `<script>` **before** `naano-chat-widget.js` loads.

## Why answers get refused so often in testing

`MIN_RELEVANCE_SCORE` (that project's `app/config.py`, default `0.3`) skips
the LLM call entirely when nothing retrieved is actually relevant — this
site's indexed content is currently just 5 marketing pages (~23 chunks), so
anything not covered by the homepage FAQ / creators / agencies / blog /
register pages will correctly come back as "The provided documents don't
contain information about this." That's the guardrail working, not a bug.
Add more pages (the app's onboarding/billing flow, docs, etc.) via the same
`/api/documents` call to widen what it can answer.

## Not done here

- The widget isn't wired into `app/*.html` (the logged-in creator/brand
  workspace) — only the public marketing pages, matching where the
  reference screenshots showed it.
- No conversation memory across questions — each query is answered
  independently (no chat history sent back to the RAG server).
- The RAG server needs to be started by hand; nothing in this repo
  auto-starts it (it's a separate project, on a separate stack).
