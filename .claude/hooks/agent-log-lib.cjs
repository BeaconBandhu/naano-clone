// Shared helpers for the .agent-logs/ prompt+response capture hooks.
// Used by capture-prompt.cjs (UserPromptSubmit) and capture-response.cjs (Stop).
// Kept dependency-free (Node core only) so it runs with whatever Node the user has.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const AUTHOR = 'Vanshhikaa04';
const TOOL = 'claude-code';
const ENTRIES_SENTINEL = '<!-- ENTRIES START -->';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', () => resolve(data));
      // In case stdin is already closed/empty on some platforms.
      if (process.stdin.isTTY) resolve(data);
    } catch (e) {
      resolve(data);
    }
  });
}

async function readStdinJson() {
  const raw = await readStdin();
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// Fallback for when the hook payload has no `model` field (observed in practice
// on this host): scan the JSONL transcript backwards for the most recent
// assistant message's `model` field.
function getModelFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n');
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i].trim();
      if (!line) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        continue;
      }
      const model = obj.model || (obj.message && obj.message.model);
      if (obj.type === 'assistant' && model) return model;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function resolveModel(input) {
  return input.model
    || getModelFromTranscript(input.transcript_path)
    || 'unknown';
}

function shortId(sessionId) {
  if (!sessionId) return 'unknown';
  return sessionId.split('-')[0].slice(0, 8);
}

function stateDir() {
  const dir = path.join(os.tmpdir(), 'agent-logs-state');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stateFilePath(sessionId) {
  return path.join(stateDir(), `${sessionId}.json`);
}

function loadState(sessionId) {
  const f = stateFilePath(sessionId);
  if (fs.existsSync(f)) {
    try {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveState(sessionId, state) {
  fs.writeFileSync(stateFilePath(sessionId), JSON.stringify(state, null, 2), 'utf8');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtDateUTC(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fmtTimeUTC(d) {
  return `${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}`;
}

function initState(sessionId, cwd, model) {
  const root = cwd || process.cwd();
  const logsDir = path.join(root, '.agent-logs');
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const now = new Date();
  const sid = shortId(sessionId);
  const fileName = `${fmtDateUTC(now)}_${fmtTimeUTC(now)}_${sid}.md`;
  const logFile = path.join(logsDir, fileName);

  const state = {
    sessionIdFull: sessionId,
    shortId: sid,
    logFile,
    count: 0,
    promptIdToNum: {},
    model: model || 'unknown',
    author: AUTHOR,
    project: path.basename(root),
    firstPromptTime: null,
    lastPromptTime: null,
    dateCreated: fmtDateUTC(now),
  };
  writeHeader(state);
  return state;
}

function frontmatterAndHeader(state) {
  return `---
session_id: ${state.sessionIdFull}
date: ${state.dateCreated}
author: ${state.author}
model: ${state.model}
tool: ${TOOL}
project: ${state.project}
total_exchanges: ${state.count}
first_prompt_time: ${state.firstPromptTime || ''}
last_prompt_time: ${state.lastPromptTime || ''}
---

# Session Log - ${state.dateCreated}

Session: \`${state.shortId}\` | Project: \`${state.project}\` | Author: \`${state.author}\`

---
${ENTRIES_SENTINEL}
`;
}

function writeHeader(state) {
  fs.writeFileSync(state.logFile, frontmatterAndHeader(state), 'utf8');
}

// Rewrites only the frontmatter+header block, preserving every entry already
// appended below the sentinel line untouched (never edits past entries).
function refreshFrontmatter(state) {
  let body = '';
  if (fs.existsSync(state.logFile)) {
    const content = fs.readFileSync(state.logFile, 'utf8');
    const idx = content.indexOf(ENTRIES_SENTINEL);
    if (idx !== -1) {
      body = content.slice(idx + ENTRIES_SENTINEL.length);
    }
  }
  fs.writeFileSync(state.logFile, frontmatterAndHeader(state) + body, 'utf8');
}

function appendEntry(state, { type, num, timestamp, model, text }) {
  const safeText = (text === undefined || text === null || text === '') ? '(empty)' : text;
  const entry = `
[LOG_ENTRY type=${type} num=${num} session=${state.shortId}]
timestamp: ${timestamp}
model: ${model}

${safeText}

`;
  fs.appendFileSync(state.logFile, entry, 'utf8');
}

// Returns the exchange number for a given prompt_id, assigning a new one
// (incrementing state.count) the first time this prompt_id is seen.
function numForPromptId(state, promptId) {
  if (!state.promptIdToNum[promptId]) {
    state.count += 1;
    state.promptIdToNum[promptId] = state.count;
  }
  return state.promptIdToNum[promptId];
}

module.exports = {
  readStdinJson,
  resolveModel,
  shortId,
  loadState,
  saveState,
  initState,
  refreshFrontmatter,
  appendEntry,
  numForPromptId,
};
