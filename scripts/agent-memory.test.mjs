import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  appendEvent, closeAgentMemory, createSession, listMemories,
  openAgentMemory, saveMemory, searchMemory,
} from "./lib/agent-memory-store.mjs";

const cli = resolve("scripts/agent-memory.mjs");
const temporaryRoots = new Set();

function tempStore() {
  const root = mkdtempSync(join(tmpdir(), "personal-calendar-agent-memory-"));
  temporaryRoots.add(root);
  return { root, dbPath: join(root, "memory.sqlite") };
}

function runCli(dbPath, ...args) {
  const result = spawnSync(process.execPath, [cli, ...args, "--db", dbPath], { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

function output(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

afterEach(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
  temporaryRoots.clear();
});

describe("agent session memory persistence", () => {
  it("recovers recorded conversation events from a fresh CLI process", () => {
    const { dbPath } = tempStore();
    const session = output(runCli(dbPath, "session", "start", "--title", "Task 16 implementation", "--branch", "dev/personal-calendar-workbench"));
    output(runCli(dbPath, "session", "append", session.id, "--role", "user", "--content", "Finish the outcome and direction flow", "--event-id", "request-1"));
    output(runCli(dbPath, "session", "append", session.id, "--role", "assistant", "--content", "Preserve existing goal links and progress", "--event-id", "response-1"));

    const recovered = output(runCli(dbPath, "session", "show", session.id));
    assert.deepEqual(recovered.events.map(event => event.role), ["user", "assistant"]);
    assert.match(recovered.events[0].content, /outcome and direction/);
  });

  it("ranks semantically overlapping memories ahead of unrelated facts", () => {
    const { dbPath } = tempStore();
    const db = openAgentMemory(dbPath);
    saveMemory(db, { content: "Use strict expected-version guards on Roadmap project moves.", tags: ["roadmap", "concurrency"] });
    saveMemory(db, { content: "Project calendar planning overview.", tags: ["planning"] });
    closeAgentMemory(db);

    const results = output(runCli(dbPath, "search", "Roadmap project version guard", "--limit", "2"));
    assert.match(results[0].content, /expected-version guards/);
    assert.ok(results[0].relevance > results[1].relevance);
  });

  it("prevents duplicate event IDs and normalized memory facts", () => {
    const { dbPath } = tempStore();
    const db = openAgentMemory(dbPath);
    const session = createSession(db, { title: "Deduplication" });
    const eventA = appendEvent(db, { sessionId: session.id, role: "user", content: "Keep task IDs stable", eventId: "turn-1" });
    const eventB = appendEvent(db, { sessionId: session.id, role: "user", content: "Different content must not replace it", eventId: "turn-1" });
    const memoryA = saveMemory(db, { content: "Preserve Planner IDs during redesign." });
    const memoryB = saveMemory(db, { content: " preserve planner IDs during redesign! " });
    assert.deepEqual(eventB, { id: eventA.id, eventKey: "turn-1", duplicate: true });
    assert.deepEqual(memoryB, { id: memoryA.id, duplicate: true });
    assert.equal(getCount(db, "events"), 1);
    assert.equal(listMemories(db).length, 1);
    closeAgentMemory(db);
  });

  it("rolls back injected memory/event write failures without damaging prior content", () => {
    const { dbPath } = tempStore();
    const db = openAgentMemory(dbPath);
    const session = createSession(db, { title: "Failure recovery", now: "2026-10-01T00:00:00.000Z" });
    const saved = saveMemory(db, { content: "Previously saved reliable memory", now: "2026-10-01T00:00:01.000Z" });
    assert.throws(() => saveMemory(db, { content: "Injected failing record", afterInsert: () => { throw new Error("simulated disk/write failure"); } }), /simulated disk\/write failure/);
    assert.throws(() => appendEvent(db, { sessionId: session.id, role: "assistant", content: "Incomplete event", eventId: "failed-event", now: "2026-10-01T00:00:02.000Z", afterInsert: () => { throw new Error("simulated event failure"); } }), /simulated event failure/);
    assert.deepEqual(listMemories(db).map(memory => memory.id), [saved.id]);
    assert.equal(getCount(db, "events"), 0);
    assert.equal(createUpdatedAt(db, session.id), "2026-10-01T00:00:00.000Z");
    closeAgentMemory(db);
  });

  it("permanently deletes a selected memory and keeps it out of later retrieval", () => {
    const { dbPath } = tempStore();
    const db = openAgentMemory(dbPath);
    const memory = saveMemory(db, { content: "Delete this temporary preference", tags: ["temporary"] });
    closeAgentMemory(db);
    const needsConfirmation = runCli(dbPath, "memory", "delete", memory.id);
    assert.equal(needsConfirmation.status, 1);
    const deleted = output(runCli(dbPath, "memory", "delete", memory.id, "--confirm"));
    assert.deepEqual(deleted, { deleted: true });
    assert.deepEqual(output(runCli(dbPath, "memory", "delete", memory.id, "--confirm")), { deleted: false });
    assert.deepEqual(output(runCli(dbPath, "memory", "search", "temporary preference")), []);
    assert.deepEqual(output(runCli(dbPath, "memory", "list")), []);
  });

  it("preserves the separate existing one-shot AI draft and chat demo code paths", () => {
    const plannerRouter = readFileSync(resolve("server/routers/planner.ts"), "utf8");
    const showcase = readFileSync(resolve("client/src/pages/ComponentShowcase.tsx"), "utf8");
    assert.ok(plannerRouter.includes("ai: router({"));
    assert.ok(plannerRouter.includes("draft: protectedProcedure"));
    assert.ok(showcase.includes("This is a **demo response**"));
  });
});

function getCount(db, table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

function createUpdatedAt(db, id) {
  return db.prepare("SELECT updated_at AS updatedAt FROM sessions WHERE id = ?").get(id).updatedAt;
}
