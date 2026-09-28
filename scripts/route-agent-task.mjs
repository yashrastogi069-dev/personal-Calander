#!/usr/bin/env node
// Advisory routing for agent work only. This file is not imported by the app.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
// Keep thresholds tied to this tested model version; review before upgrading.
export const JEV_MODEL = "jev-1.13.0";
export const FALLBACK = Object.freeze({ model: "gpt-6-sol", effort: "high" });

const CRITERIA = {
  small_mechanical: "A bounded, reversible, low-risk edit such as a typo, simple formatting, or a trivial rename with clear verification. No architecture, data, security, deployment, UX judgment, or complex debugging.",
  ordinary: "A scoped implementation or investigation needing judgment, but without important product, architecture, data, security, deployment, or difficult uncertainty.",
  important_difficult_high_risk: "Important, difficult, ambiguous, or high-risk work; architecture, migration, authentication, privacy, security, data integrity, deployment, production, broad refactor, or substantial UX/product decisions. When unsure, choose this.",
};
const HIGH_RISK_TERMS = /\b(auth(?:entication|orization)?|security|privacy|secret|database|migration|deploy(?:ment)?|production|infrastructure|payment|data loss|data integrity|architecture|critical|high.risk|difficult|complex)\b/i;

export function validateSummary(input) {
  if (typeof input !== "string") throw new Error("A short task summary is required.");
  const summary = input.trim();
  if (summary.length < 8 || summary.length > 240 || /[\r\n\x00-\x1f]/.test(summary)) {
    throw new Error("Use a single-line task summary of 8–240 characters.");
  }
  // This catches common accidental dumps; the caller remains responsible for summarizing safely.
  if (/sk-[A-Za-z0-9_-]{12,}|(?:api[_ -]?key|token|password|secret)\s*[:=]\s*\S{8,}|-----BEGIN |https?:\/\/\S+|[{};`]/i.test(summary)) {
    throw new Error("Use a plain task summary without secrets, URLs, or source code.");
  }
  return summary;
}

export function requestFor(summary) {
  return {
    model: JEV_MODEL,
    state: { task_summary: validateSummary(summary) },
    questions: {
      task_class: {
        type: "choice",
        instructions: "Classify the agent task_summary for model routing. Preserve quality. If the task might be important, difficult, or risky, choose important_difficult_high_risk.",
        criteria: CRITERIA,
      },
    },
  };
}

export function routeFromDecision(response) {
  const answer = response?.answers?.task_class;
  const probabilities = answer?.probabilities;
  const keys = Object.keys(CRITERIA);
  if (answer?.type !== "choice" || !keys.includes(answer.choice) ||
      !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1 ||
      !probabilities || keys.some((key) => !Number.isFinite(probabilities[key]) || probabilities[key] < 0 || probabilities[key] > 1) ||
      Math.abs(keys.reduce((sum, key) => sum + probabilities[key], 0) - 1) > 0.02 ||
      probabilities[answer.choice] < Math.max(...keys.map((key) => probabilities[key]))) {
    return { ...FALLBACK, reason: "invalid_decision" };
  }
  if (answer.choice === "small_mechanical" && answer.confidence >= 0.9 &&
      probabilities.small_mechanical >= 0.9 && probabilities.important_difficult_high_risk <= 0.05) {
    return { model: "gpt-6-sol", effort: "low", reason: "clear_small_mechanical" };
  }
  if (answer.choice === "ordinary" && answer.confidence >= 0.8 &&
      probabilities.important_difficult_high_risk <= 0.1) {
    return { model: "gpt-6-sol", effort: "medium", reason: "ordinary" };
  }
  return { ...FALLBACK, reason: "important_or_uncertain" };
}

export async function recommendRoute(summary, { apiKey, fetchImpl = fetch } = {}) {
  const body = requestFor(summary);
  if (HIGH_RISK_TERMS.test(body.state.task_summary)) {
    return { ...FALLBACK, reason: "high_risk_guard" };
  }
  if (!apiKey) return { ...FALLBACK, reason: "missing_api_key" };
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { ...FALLBACK, reason: "api_unavailable" };
    return routeFromDecision(await response.json());
  } catch {
    // Never surface network errors: they can include request headers or summary text.
    return { ...FALLBACK, reason: "api_unavailable" };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const summary = args.filter((arg) => arg !== "--dry-run").join(" ");
  try {
    validateSummary(summary);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ ...FALLBACK, reason: "dry_run" })}\n`);
    return;
  }
  let apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    try {
      const envPath = fileURLToPath(new URL("../.env", import.meta.url));
      apiKey = parse(await readFile(envPath)).TYPESAFE_API_KEY;
    } catch {
      // Missing or unreadable .env uses the conservative fallback.
    }
  }
  process.stdout.write(`${JSON.stringify(await recommendRoute(summary, { apiKey }))}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
