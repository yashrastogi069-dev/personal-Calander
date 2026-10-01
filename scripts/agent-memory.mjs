#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import {
  appendEvent, closeAgentMemory, createSession, deleteMemory, deleteSession,
  getSession, listMemories, listSessions, openAgentMemory, saveMemory, searchMemory,
} from "./lib/agent-memory-store.mjs";

const help = `Agent session memory (local to this checkout)

Usage:
  node scripts/agent-memory.mjs session start --title TEXT [--branch NAME] [--db PATH]
  node scripts/agent-memory.mjs session append ID --role ROLE --content TEXT [--event-id KEY] [--db PATH]
  node scripts/agent-memory.mjs session list [--limit N] [--db PATH]
  node scripts/agent-memory.mjs session show ID [--db PATH]
  node scripts/agent-memory.mjs session delete ID --confirm [--db PATH]
  node scripts/agent-memory.mjs memory add --content TEXT [--tags a,b] [--session ID] [--db PATH]
  node scripts/agent-memory.mjs memory list [--db PATH]
  node scripts/agent-memory.mjs memory search QUERY [--limit N] [--db PATH]
  node scripts/agent-memory.mjs memory delete ID --confirm [--db PATH]
  node scripts/agent-memory.mjs search QUERY [--limit N] [--db PATH]

The default SQLite store is temp/agent-memory/memory.sqlite (ignored by Git).
Session capture is explicit; this tool cannot read the host application's transcript.
Delete removes the selected local session or memory permanently.`;

function parseArgs(args) {
  const positional = [];
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      if (key === "confirm") options.confirm = true;
      else {
        if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Option --${key} requires a value.`);
        options[key] = args[++index];
      }
    } else positional.push(value);
  }
  return { positional, options };
}

function requireOption(options, name) {
  if (!options[name]?.trim()) throw new Error(`Required option: --${name}`);
  return options[name];
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function runAgentMemoryCli(args = process.argv.slice(2), cwd = process.cwd()) {
  if (!args.length || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${help}\n`);
    return 0;
  }
  const { positional, options } = parseArgs(args);
  const [area, action, ...rest] = positional;
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const defaultPath = resolve(repositoryRoot, "temp/agent-memory/memory.sqlite");
  const db = openAgentMemory(options.db ? resolve(cwd, options.db) : defaultPath);
  try {
    if (area === "session" && action === "start") {
      emit(createSession(db, { title: requireOption(options, "title"), branch: options.branch ?? null }));
    } else if (area === "session" && action === "append") {
      const id = rest[0];
      if (!id) throw new Error("Usage requires a session ID.");
      emit(appendEvent(db, { sessionId: id, role: requireOption(options, "role"), content: requireOption(options, "content"), eventId: options["event-id"] }));
    } else if (area === "session" && action === "list") {
      emit(listSessions(db, options.limit ? Number(options.limit) : 50));
    } else if (area === "session" && action === "show") {
      const session = getSession(db, rest[0]);
      if (!session) throw new Error("Session not found.");
      emit(session);
    } else if (area === "session" && action === "delete") {
      if (!options.confirm) throw new Error("Permanent deletion requires --confirm.");
      emit({ deleted: deleteSession(db, rest[0]) });
    } else if (area === "memory" && action === "add") {
      emit(saveMemory(db, { content: requireOption(options, "content"), tags: options.tags?.split(",") ?? [], sourceSessionId: options.session ?? null }));
    } else if (area === "memory" && action === "list") {
      emit(listMemories(db, options.limit ? Number(options.limit) : 50));
    } else if (area === "memory" && action === "search") {
      const query = rest.join(" ");
      if (!query.trim()) throw new Error("Provide a search query.");
      emit(searchMemory(db, query, { includeEvents: false, limit: options.limit ? Number(options.limit) : 10 }));
    } else if (area === "memory" && action === "delete") {
      if (!options.confirm) throw new Error("Permanent deletion requires --confirm.");
      emit({ deleted: deleteMemory(db, rest[0]) });
    } else if (area === "search") {
      const query = [action, ...rest].filter(Boolean).join(" ");
      if (!query.trim()) throw new Error("Provide a search query.");
      emit(searchMemory(db, query, { limit: options.limit ? Number(options.limit) : 10 }));
    } else {
      throw new Error("Unknown command. Run with --help.");
    }
    return 0;
  } finally {
    closeAgentMemory(db);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = runAgentMemoryCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Agent memory operation failed."}\n`);
    process.exitCode = 1;
  }
}
