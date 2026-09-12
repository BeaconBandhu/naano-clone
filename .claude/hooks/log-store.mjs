// Shared read/write helpers for .agent-logs/ session files.
// Used by capture-prompt.mjs (UserPromptSubmit) and capture-response.mjs (Stop).
// Format matches the 8x Assignment agent-capture spec exactly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const LOG_DIR = path.join(REPO_ROOT, ".agent-logs");
export const MODEL_CACHE = path.join(__dirname, ".model-cache.json");
export const DEBUG_PAYLOAD = path.join(__dirname, ".debug-last-payload.json");

export const DEFAULT_AUTHOR = process.env.AGENT_LOG_AUTHOR || "BeaconBandhu";
export const DEFAULT_PROJECT = process.env.AGENT_LOG_PROJECT || "naano-clone";
export const TOOL_NAME = "claude-code";

export function nowIso() {
  return new Date().toISOString();
}

export function shortId(sessionId) {
  return String(sessionId || "unknown").split("-")[0];
}

export function readModelCache() {
  try {
    return JSON.parse(fs.readFileSync(MODEL_CACHE, "utf8")).model || "unknown";
  } catch {
    return "unknown";
  }
}

export function writeModelCache(model) {
  if (!model) return;
  try {
    fs.writeFileSync(MODEL_CACHE, JSON.stringify({ model }), "utf8");
  } catch {
    /* non-fatal */
  }
}

// Any hook parse failure lands here instead of crashing the hook (which would
// otherwise surface as a scary error in the user's session for a logging side-effect).
export function dumpDebug(label, payload) {
  try {
    fs.writeFileSync(
      DEBUG_PAYLOAD,
      JSON.stringify({ label, at: nowIso(), payload }, null, 2),
      "utf8"
    );
  } catch {
    /* non-fatal */
  }
}

function fileStamp(date) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}_` +
    `${p(date.getUTCHours())}-${p(date.getUTCMinutes())}-${p(date.getUTCSeconds())}`
  );
}

export function findSessionLogFile(sessionId) {
  if (!fs.existsSync(LOG_DIR)) return null;
  const suffix = `_${sessionId}.md`;
  const hit = fs.readdirSync(LOG_DIR).find((f) => f.endsWith(suffix));
  return hit ? path.join(LOG_DIR, hit) : null;
}

export function ensureSessionLog({ sessionId, model }) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const existing = findSessionLogFile(sessionId);
  if (existing) return existing;

  const now = new Date();
  const dateOnly = now.toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, `${fileStamp(now)}_${sessionId}.md`);
  const front = [
    "---",
    `session_id: ${sessionId}`,
    `date: ${dateOnly}`,
    `author: ${DEFAULT_AUTHOR}`,
    `model: ${model}`,
    `tool: ${TOOL_NAME}`,
    `project: ${DEFAULT_PROJECT}`,
    "total_exchanges: 0",
    `first_prompt_time: ${nowIso()}`,
    `last_prompt_time: ${nowIso()}`,
    "---",
    "",
    `# Session Log - ${dateOnly}`,
    "",
    `Session: \`${shortId(sessionId)}\` | Project: \`${DEFAULT_PROJECT}\` | Author: \`${DEFAULT_AUTHOR}\``,
    "",
    "---",
    "",
    "",
  ].join("\n");
  fs.writeFileSync(file, front, "utf8");
  return file;
}

const FRONTMATTER_KEYS = [
  "session_id",
  "date",
  "author",
  "model",
  "tool",
  "project",
  "total_exchanges",
  "first_prompt_time",
  "last_prompt_time",
];

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  const fields = {};
  if (!m) return fields;
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fields;
}

function rewriteFrontmatter(text, fields) {
  const block = ["---", ...FRONTMATTER_KEYS.map((k) => `${k}: ${fields[k] ?? ""}`), "---"].join(
    "\n"
  );
  return text.replace(/^---\n[\s\S]*?\n---\n/, block + "\n");
}

export function appendPromptEntry(file, { sessionId, model, prompt }) {
  let text = fs.readFileSync(file, "utf8");
  const fields = parseFrontmatter(text);
  const num = (text.match(/\[LOG_ENTRY type=PROMPT/g) || []).length + 1;
  const ts = nowIso();

  if (model && model !== "unknown") fields.model = model;
  fields.total_exchanges = String(Math.max(Number(fields.total_exchanges || 0), num));
  fields.last_prompt_time = ts;
  text = rewriteFrontmatter(text, fields);

  text += [
    `[LOG_ENTRY type=PROMPT num=${num} session=${shortId(sessionId)}]`,
    `timestamp: ${ts}`,
    `model: ${model}`,
    "",
    prompt,
    "",
    "",
  ].join("\n");
  fs.writeFileSync(file, text, "utf8");
  return num;
}

export function appendResponseEntry(file, { sessionId, model, response }) {
  let text = fs.readFileSync(file, "utf8");
  const fields = parseFrontmatter(text);
  const promptCount = (text.match(/\[LOG_ENTRY type=PROMPT/g) || []).length;
  const responseCount = (text.match(/\[LOG_ENTRY type=RESPONSE/g) || []).length;
  const num = Math.max(responseCount + 1, promptCount);
  const ts = nowIso();

  if (model && model !== "unknown") fields.model = model;
  text = rewriteFrontmatter(text, fields);

  text += [
    `[LOG_ENTRY type=RESPONSE num=${num} session=${shortId(sessionId)}]`,
    `timestamp: ${ts}`,
    `model: ${model}`,
    "",
    response,
    "",
    "",
  ].join("\n");
  fs.writeFileSync(file, text, "utf8");
  return num;
}
