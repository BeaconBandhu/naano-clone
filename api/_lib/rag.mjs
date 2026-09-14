/* Naano website RAG — retrieval + grounded generation, native to this repo.
 *
 * Earlier this was a separate Python/FastAPI project (FAISS + Sentence-
 * Transformers + torch) run alongside this one — see docs/naano-notes.md's
 * chatbot changelog entries and the old CHATBOT.md for that history. That
 * doesn't fit Vercel: torch alone is ~550MB (well past the ~250MB
 * serverless function limit), sentence-transformers needs it just to
 * embed a query, and the FAISS index needs a persistent disk a serverless
 * function doesn't have. This version drops all of that: retrieval is a
 * small precomputed JSON of {text, source, embedding} (rag-index.json,
 * ~45 chunks from this site's 5 public pages) searched with plain
 * brute-force cosine similarity in JS — fast enough at this corpus size
 * that an ANN index (FAISS/HNSW) buys nothing — and both embedding and
 * generation are OpenAI REST calls over `fetch`, matching how
 * api/_lib/stripe.mjs already talks to Stripe (no SDK dependency).
 *
 * Rebuilding the index: node scripts/build-rag-index.mjs (with the local
 * dev server running) re-fetches the 5 pages and re-embeds them. Run it
 * again any time the marketing copy changes materially — it's not
 * automatic, same caveat the old CHATBOT.md called out.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const OPENAI_BASE = "https://api.openai.com/v1";
const EMBEDDING_MODEL = "text-embedding-3-small";
const GENERATION_MODEL = "gpt-5.4-mini";
const GENERATION_MAX_TOKENS = 300;
const DEFAULT_TOP_K = 5;

// Same threshold and reasoning as the Python project's MIN_RELEVANCE_SCORE:
// a nearest-neighbor search always returns *something*, even when nothing
// in the corpus is actually relevant. Below this, skip the LLM call and
// answer "not in the documents" directly — faster, cheaper, more honest.
const MIN_RELEVANCE_SCORE = 0.3;

const INDEX_PATH = join(fileURLToPath(new URL(".", import.meta.url)), "rag-index.json");
let INDEX_CACHE = null;

async function loadIndex() {
  if (INDEX_CACHE) return INDEX_CACHE;
  try {
    INDEX_CACHE = JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch {
    INDEX_CACHE = [];
  }
  return INDEX_CACHE;
}

function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error("OPENAI_API_KEY is not set — the chatbot can't embed or generate without it.");
    err.status = 503;
    throw err;
  }
  return key;
}

async function embed(text, apiKey) {
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OpenAI embeddings request failed (${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status >= 400 && res.status < 500 ? 502 : 500;
    throw err;
  }
  const data = await res.json();
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

/** query -> embed -> brute-force cosine search over the precomputed index. */
export async function search(query, topK = DEFAULT_TOP_K) {
  const apiKey = requireApiKey();
  const index = await loadIndex();
  if (!index.length) return { results: [], lowRelevance: true };
  const qVec = await embed(query, apiKey);
  const scored = index
    .map((chunk) => ({ text: chunk.text, source: chunk.source, score: cosineSimilarity(qVec, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  const lowRelevance = !scored.length || scored[0].score < MIN_RELEVANCE_SCORE;
  return { results: scored, lowRelevance };
}

const SYSTEM_PROMPT =
  "You are Naano's website assistant. Answer ONLY using the provided context chunks from " +
  "this site's own pages — never your own general knowledge. If the context does not contain " +
  "the answer, reply with exactly: \"The provided documents don't contain information about this.\" " +
  "Keep answers concise (2-4 sentences). When you use a chunk, cite its source filename in " +
  "parentheses like (source: creators.html).";

/** query -> search -> (if relevant) a grounded, cited answer. Mirrors the old
 *  Python project's /api/ask contract: {answer, grounded, sources}. */
export async function ask(query, topK = DEFAULT_TOP_K) {
  const apiKey = requireApiKey();
  const { results, lowRelevance } = await search(query, topK);
  if (lowRelevance) {
    return { answer: "The provided documents don't contain information about this.", grounded: false, sources: [] };
  }
  const context = results.map((r, i) => `[${i + 1}] (source: ${r.source})\n${r.text}`).join("\n\n");
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GENERATION_MODEL,
      max_completion_tokens: GENERATION_MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OpenAI chat completion failed (${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status >= 400 && res.status < 500 ? 502 : 500;
    throw err;
  }
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content?.trim() || "The provided documents don't contain information about this.";
  const declined = /provided documents don.t contain/i.test(answer);
  const uniqSources = [...new Set(results.map((r) => r.source))];
  return { answer, grounded: !declined, sources: declined ? [] : results.map((r) => ({ text: r.text, source: r.source, score: r.score })), uniqSources };
}
