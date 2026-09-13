# Agent capture log

Automatic, per-turn capture of Claude Code prompts and final responses for this
repo, per the 8x Assignment agent-capture spec. Written by two hooks configured
in [`../.claude/settings.json`](../.claude/settings.json):

- `UserPromptSubmit` → [`.claude/hooks/capture-prompt.mjs`](../.claude/hooks/capture-prompt.mjs) — appends the prompt, verbatim, the moment it's submitted.
- `Stop` → [`.claude/hooks/capture-response.mjs`](../.claude/hooks/capture-response.mjs) — appends the final assistant text of that turn (thinking, tool calls, and intermediate steps are read from the transcript and deliberately excluded).

One file per session: `YYYY-MM-DD_HH-MM-SS_<session-id>.md`, created on that
session's first prompt. Entries are appended only — never edited or reordered
after the fact.

Capture went live **2026-09-12**. See `CAPTURE-TEST.md` in the repo root for
the install verification (canary prompts in two separate sessions).

Work on this project done before 2026-09-12 happened in Claude.ai web chat
sessions, before this hook existed, and is not represented in this directory
in hook format. If those earlier conversations get added here, they will be
appended as a clearly separate, dated note referencing the original chats —
not reformatted to look like automatic capture.
