import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const stopWords = new Set(["about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "but", "can", "could", "did", "does", "for", "from", "have", "into", "its", "just", "more", "most", "not", "our", "out", "over", "same", "should", "that", "the", "their", "them", "then", "there", "these", "they", "this", "through", "under", "very", "was", "were", "what", "when", "where", "which", "while", "with", "would", "your"]);

export function normalizeText(value) {
  return String(value).normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function fingerprint(value) {
  return createHash("sha256").update(normalizeText(value)).digest("hex");
}

function tokens(value) {
  return [...new Set(normalizeText(value).split(" ").filter(token => token.length > 1 && !stopWords.has(token)))];
}

function score(query, content, tags = "") {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return 0;
  const normalized = normalizeText(content);
  const tagSet = new Set(tokens(tags));
  let points = 0;
  for (const token of queryTokens) {
    if (tagSet.has(token)) points += 3;
    const occurrences = normalized.split(token).length - 1;
    if (occurrences) points += 1 + Math.min(occurrences, 3) * 0.25;
  }
  const phrase = normalizeText(query);
  if (phrase.length > 2 && normalized.includes(phrase)) points += 2;
  return points / queryTokens.length;
}

function transaction(db, operation) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

export function openAgentMemory(dbPath) {
  const path = resolve(dbPath);
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      branch TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete', 'paused')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool', 'checkpoint')),
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, event_key)
    );
    CREATE INDEX IF NOT EXISTS events_session_created_idx ON events(session_id, created_at);
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      source_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      tags TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

export function createSession(db, { title, branch = null, id = randomUUID(), now = new Date().toISOString() }) {
  const safeTitle = String(title ?? "").trim();
  if (!safeTitle) throw new Error("Session title is required.");
  db.prepare("INSERT INTO sessions (id, title, branch, status, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)").run(id, safeTitle, branch, now, now);
  return getSession(db, id);
}

export function getSession(db, id) {
  const session = db.prepare("SELECT id, title, branch, status, created_at AS createdAt, updated_at AS updatedAt FROM sessions WHERE id = ?").get(id);
  if (!session) return null;
  const events = db.prepare("SELECT id, event_key AS eventKey, role, content, created_at AS createdAt FROM events WHERE session_id = ? ORDER BY created_at, rowid").all(id);
  return { ...session, events };
}

export function listSessions(db, limit = 50) {
  const bounded = Math.max(1, Math.min(200, Number.isInteger(limit) ? limit : 50));
  return db.prepare("SELECT s.id, s.title, s.branch, s.status, s.created_at AS createdAt, s.updated_at AS updatedAt, COUNT(e.id) AS eventCount FROM sessions s LEFT JOIN events e ON e.session_id = s.id GROUP BY s.id ORDER BY s.updated_at DESC LIMIT ?").all(bounded);
}

export function appendEvent(db, { sessionId, role, content, eventId = randomUUID(), now = new Date().toISOString(), afterInsert }) {
  const text = String(content ?? "").trim();
  if (!text) throw new Error("Event content is required.");
  if (!new Set(["user", "assistant", "system", "tool", "checkpoint"]).has(role)) throw new Error("Unsupported event role.");
  return transaction(db, () => {
    const existing = db.prepare("SELECT id, event_key AS eventKey FROM events WHERE session_id = ? AND event_key = ?").get(sessionId, eventId);
    if (existing) return { ...existing, duplicate: true };
    const id = randomUUID();
    db.prepare("INSERT INTO events (id, session_id, event_key, role, content, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, sessionId, eventId, role, text, fingerprint(text), now);
    if (afterInsert) afterInsert();
    db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(now, sessionId);
    return { id, eventKey: eventId, duplicate: false };
  });
}

export function saveMemory(db, { content, sourceSessionId = null, tags = [], now = new Date().toISOString(), afterInsert }) {
  const text = String(content ?? "").trim();
  if (!text) throw new Error("Memory content is required.");
  const contentHash = fingerprint(text);
  const tagText = [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))].join(" ");
  return transaction(db, () => {
    const duplicate = db.prepare("SELECT id FROM memories WHERE content_hash = ?").get(contentHash);
    if (duplicate) return { id: duplicate.id, duplicate: true };
    const id = randomUUID();
    db.prepare("INSERT INTO memories (id, content, content_hash, source_session_id, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, text, contentHash, sourceSessionId, tagText, now, now);
    if (afterInsert) afterInsert();
    return { id, duplicate: false };
  });
}

export function searchMemory(db, query, { limit = 10, includeEvents = true } = {}) {
  const bounded = Math.max(1, Math.min(50, Number.isInteger(limit) ? limit : 10));
  const matches = [];
  for (const row of db.prepare("SELECT id, content, tags, source_session_id AS sourceSessionId, created_at AS createdAt, updated_at AS updatedAt FROM memories").all()) {
    const relevance = score(query, row.content, row.tags);
    if (relevance > 0) matches.push({ type: "memory", ...row, relevance });
  }
  if (includeEvents) {
    for (const row of db.prepare("SELECT e.id, e.session_id AS sessionId, e.role, e.content, e.created_at AS createdAt, s.title AS sessionTitle FROM events e JOIN sessions s ON s.id = e.session_id").all()) {
      const relevance = score(query, `${row.sessionTitle} ${row.content}`);
      if (relevance > 0) matches.push({ type: "event", ...row, relevance });
    }
  }
  return matches.sort((a, b) => b.relevance - a.relevance || b.createdAt.localeCompare(a.createdAt)).slice(0, bounded);
}

export function listMemories(db, limit = 50) {
  const bounded = Math.max(1, Math.min(200, Number.isInteger(limit) ? limit : 50));
  return db.prepare("SELECT id, content, source_session_id AS sourceSessionId, tags, created_at AS createdAt, updated_at AS updatedAt FROM memories ORDER BY updated_at DESC LIMIT ?").all(bounded);
}

export function deleteMemory(db, id) {
  return Number(db.prepare("DELETE FROM memories WHERE id = ?").run(id).changes) > 0;
}

export function deleteSession(db, id) {
  return transaction(db, () => Number(db.prepare("DELETE FROM sessions WHERE id = ?").run(id).changes) > 0);
}

export function closeAgentMemory(db) {
  db.close();
}
