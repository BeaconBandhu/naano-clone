#!/usr/bin/env node
// UserPromptSubmit hook: logs the verbatim prompt to .agent-logs/.
// Fires automatically on every prompt the user sends; never blocks the prompt
// (always exits 0, even on internal error) so capture failures can't affect the session.

'use strict';

const lib = require('./agent-log-lib.cjs');

async function main() {
  const input = await lib.readStdinJson();

  const sessionId = input.session_id || 'unknown-session';
  const promptId = input.prompt_id || `noid-${Date.now()}`;
  const promptText = input.prompt !== undefined ? input.prompt : '';
  const model = lib.resolveModel(input);
  // Use the hook process's own cwd (Claude Code spawns hooks with cwd = project
  // root) rather than input.cwd, which can arrive in a foreign path format.
  const cwd = process.cwd();

  let state = lib.loadState(sessionId);
  if (!state) {
    state = lib.initState(sessionId, cwd, model);
  }

  const timestamp = new Date().toISOString();
  if (!state.firstPromptTime) state.firstPromptTime = timestamp;
  state.lastPromptTime = timestamp;
  if (model) state.model = model;

  const num = lib.numForPromptId(state, promptId);

  lib.refreshFrontmatter(state);
  lib.appendEntry(state, { type: 'PROMPT', num, timestamp, model, text: promptText });
  lib.saveState(sessionId, state);
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0)); // never fail the user's turn because of a logging bug
