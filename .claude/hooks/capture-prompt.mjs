#!/usr/bin/env node
// Claude Code UserPromptSubmit hook.
// Fires the moment a prompt is submitted; stdin is a JSON payload including
// { session_id, transcript_path, cwd, hook_event_name, prompt }.
// Appends a PROMPT entry to .agent-logs/<session>.md, creating the file on
// the session's first prompt. Never blocks the prompt: always exits 0.

import { ensureSessionLog, appendPromptEntry, readModelCache, dumpDebug } from "./log-store.mjs";

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const sessionId = payload.session_id || payload.sessionId || "unknown-session";
    const prompt = payload.prompt ?? payload.message ?? "";
    const model = readModelCache(); // best known model as of the last response; see capture-response.mjs

    const file = ensureSessionLog({ sessionId, model });
    appendPromptEntry(file, { sessionId, model, prompt });
  } catch (err) {
    dumpDebug("capture-prompt-error", { error: String(err), raw });
  }
  process.exit(0);
});
