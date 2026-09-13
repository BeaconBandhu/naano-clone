#!/usr/bin/env node
// Claude Code Stop hook.
// Fires when the agent finishes a turn; stdin is a JSON payload including
// { session_id, transcript_path, hook_event_name, stop_hook_active }.
// transcript_path points at the session's JSONL transcript. We read only the
// LAST assistant message and keep only its "text" content blocks - no
// thinking, no tool_use/tool_result blocks, no intermediate assistant
// messages from earlier tool-call rounds in the same turn. That is "the
// final response," per the spec. Never blocks the turn: always exits 0.

import fs from "node:fs";
import {
  ensureSessionLog,
  appendResponseEntry,
  writeModelCache,
  dumpDebug,
} from "./log-store.mjs";

function lastAssistantText(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let entry;
    try {
      entry = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = entry.message || entry;
    const role = entry.type || msg.role;
    if (role === "assistant" && msg.content) {
      const blocks = Array.isArray(msg.content) ? msg.content : [];
      const text = blocks
        .filter((b) => b && b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) return { text, model: msg.model || entry.model || null };
    }
  }
  return { text: "", model: null };
}

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw || "{}");
    const sessionId = payload.session_id || payload.sessionId || "unknown-session";
    const transcriptPath = payload.transcript_path || payload.transcriptPath;

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      dumpDebug("capture-response-no-transcript", payload);
      process.exit(0);
    }

    const { text, model } = lastAssistantText(transcriptPath);
    if (model) writeModelCache(model);

    const file = ensureSessionLog({ sessionId, model: model || "unknown" });
    appendResponseEntry(file, {
      sessionId,
      model: model || "unknown",
      response: text || "(no text content captured for this turn)",
    });
  } catch (err) {
    dumpDebug("capture-response-error", { error: String(err), raw });
  }
  process.exit(0);
});
