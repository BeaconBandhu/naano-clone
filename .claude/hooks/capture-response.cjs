#!/usr/bin/env node
// Stop hook: logs the model's final text response for the turn to .agent-logs/.
// Uses `last_assistant_message` from the hook payload, which is the assistant's
// final text output for the turn only -- no thinking blocks, no tool calls/results.
// Fires automatically at end-of-turn; never blocks stopping (always exits 0).

'use strict';

const lib = require('./agent-log-lib.cjs');

async function main() {
  const input = await lib.readStdinJson();

  const sessionId = input.session_id || 'unknown-session';
  const promptId = input.prompt_id || `noid-${Date.now()}`;
  const model = lib.resolveModel(input);
  const cwd = process.cwd();
  const responseText = (input.last_assistant_message !== undefined && input.last_assistant_message !== null)
    ? input.last_assistant_message
    : '';

  let state = lib.loadState(sessionId);
  if (!state) {
    // Stop fired without a prior UserPromptSubmit in this state store (e.g. state
    // lost/expired) -- still capture the response rather than dropping it.
    state = lib.initState(sessionId, cwd, model);
  }

  if (model) state.model = model;
  const num = lib.numForPromptId(state, promptId);
  const timestamp = new Date().toISOString();

  lib.refreshFrontmatter(state);
  lib.appendEntry(state, { type: 'RESPONSE', num, timestamp, model, text: responseText });
  lib.saveState(sessionId, state);
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
