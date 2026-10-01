# Agent session memory

This repository's agent memory is local working history for development sessions. It is separate from Personal Calendar user data and the Supabase planner database. The CLI uses Node's built-in SQLite support (verified on Node v24.15.0) and keeps its database under the repository's ignored `temp/` folder.

## Capture boundary

The repository cannot read the host's private conversation transcript automatically. Agents must explicitly record the relevant conversation turns, decisions, actions, and verification through the local memory CLI. A saved session can be recovered after restarting the application or agent process; an unsaved host conversation cannot.

Capture enough of the user's request and the agent's response to preserve intent, constraints, decisions, current work, test results, and remaining risks. Do not store credentials, access tokens, or raw planner records. Keep `MEMORY.md` as a short curated index and use session storage for detailed work history.

## Required behavior

- Sessions and events remain available after a fresh process opens the store.
- Search ranks relevant sessions and memories and shows enough source/date context to judge relevance.
- Repeated event IDs or equivalent memory facts do not create duplicates.
- Each write is transactional or atomic: interruption or injected failure leaves prior saved content intact.
- A user can list, inspect, and permanently delete a selected memory or session; deleted content is excluded from retrieval.
- Storage is local, excluded from Git, and never connected to planner account records.
- Integration tests reopen the same temporary store from another process and cover recovery, deduplication, ranking, failed writes, deletion, and existing workflow compatibility.

## Use and recovery

See `node scripts/agent-memory.mjs --help` for the current command syntax. Check the short [working memory](../MEMORY.md) and [project state](PROJECT_STATE.md), then search recent saved sessions before implementation. Record a short checkpoint after meaningful work and verify it can be recalled from a new process.

Example:

```powershell
node scripts/agent-memory.mjs session start --title "Phase 4 Task 16" --branch dev/personal-calendar-workbench
node scripts/agent-memory.mjs session append SESSION_ID --role user --content "Preserve all goal links and history" --event-id request-20261001
node scripts/agent-memory.mjs session append SESSION_ID --role checkpoint --content "Tests passed; metadata editing still needs a migration-safe path" --event-id checkpoint-20261001
node scripts/agent-memory.mjs search "goal metadata migration safe"
node scripts/agent-memory.mjs session show SESSION_ID
```

Keep an event ID stable when retrying a write. The same ID in a session is idempotent. Re-saving a memory with equivalent normalized text returns the existing memory ID. Deletion requires `--confirm` and permanently removes the chosen local record.

The transcript is only as complete as the events explicitly recorded. Do not describe the tool as an automatic host conversation archive.
