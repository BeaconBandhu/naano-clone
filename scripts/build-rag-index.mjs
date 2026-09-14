#!/usr/bin/env node
/* Rebuilds api/_lib/rag-index.json — the chatbot's retrieval corpus.
 *
 *   node scripts/build-rag-index.mjs
 *
 * Requires the local dev server running (npm run dev, port 5173 by
 * default) and OPENAI_API_KEY set (loaded from .env, same as
 * server/serve.mjs does). Re-fetches this site's public pages, strips
 * them to visible text, chunks paragraph/sentence-aware (a simplified
 * version of the old Python project's app/chunking.py — good enough at
 * this corpus size), embeds every chunk via OpenAI, and writes the
 * result out. Run again whenever the marketing copy changes materially —
 * this is not automatic.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASE_URL = process.env.SITE_URL || "http://localhost:5173";
const PAGES = ["", "pages/creators.html", "pages/agencies.html", "pages/blog.html", "pages/register.html"];
const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 60;
const EMBEDDING_MODEL = "text-embedding-3-small";
const OUT_PATH = join(ROOT, "api", "_lib", "rag-index.json");

// load repo-root .env, same minimal parser as server/serve.mjs
try {
  const env = await readFile(join(ROOT, ".env"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env — fine, OPENAI_API_KEY may already be in the environment */ }

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY not set (checked .env and the environment). Aborting.");
  process.exit(1);
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|p|div|section|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*\n[ \t]*(\n[ \t]*)+/g, "\n\n")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();
}

// Paragraph/sentence-aware chunker (simplified port of app/chunking.py):
// pack whole sentences up to CHUNK_SIZE chars, never splitting mid-sentence;
// carry the trailing sentence(s) of one chunk into the next as overlap.
function chunkText(text) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  const sentences = [];
  for (const p of paragraphs) {
    const parts = p.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [p];
    for (const s of parts) { const t = s.trim(); if (t) sentences.push(t); }
  }
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const s of sentences) {
    if (currentLen + s.length > CHUNK_SIZE && current.length) {
      chunks.push(current.join(" "));
      // carry trailing sentence(s) as overlap
      let overlap = [];
      let overlapLen = 0;
      for (let i = current.length - 1; i >= 0 && overlapLen < CHUNK_OVERLAP; i--) {
        overlap.unshift(current[i]);
        overlapLen += current[i].length;
      }
      current = overlap;
      currentLen = overlapLen;
    }
    current.push(s);
    currentLen += s.length;
  }
  if (current.length) chunks.push(current.join(" "));
  return chunks;
}

async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`embeddings failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

const out = [];
for (const page of PAGES) {
  const url = `${BASE_URL}/${page}`;
  console.log(`fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`  skip (${res.status})`); continue; }
  const html = await res.text();
  const text = htmlToText(html);
  const chunks = chunkText(text);
  const source = page === "" ? "index.html" : page.split("/").pop();
  console.log(`  ${chunks.length} chunks from ${source}`);
  for (const chunk of chunks) {
    const embedding = await embed(chunk);
    out.push({ text: chunk, source, embedding });
  }
}

await writeFile(OUT_PATH, JSON.stringify(out), "utf8");
console.log(`\nWrote ${out.length} chunks to ${OUT_PATH}`);
