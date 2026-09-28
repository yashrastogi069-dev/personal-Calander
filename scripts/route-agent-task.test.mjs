import assert from "node:assert/strict";
import { test } from "node:test";
import { ENDPOINT, JEV_MODEL, recommendRoute, requestFor, routeFromDecision, validateSummary } from "./route-agent-task.mjs";

function decision(choice, confidence, small, ordinary, important) {
  return { answers: { task_class: { type: "choice", choice, confidence, probabilities: {
    small_mechanical: small, ordinary, important_difficult_high_risk: important,
  } } } };
}

test("request uses the pinned direct TypeSafe API shape", () => {
  const request = requestFor("Fix a spelling mistake in a label");
  assert.equal(request.model, "jev-1.13.0");
  assert.equal(JEV_MODEL, "jev-1.13.0");
  assert.equal(request.questions.task_class.type, "choice");
  assert.deepEqual(Object.keys(request.state), ["task_summary"]);
  assert.equal(ENDPOINT, "https://api.typesafe.ai/v1/systemone");
});

test("small mechanical work defaults to SOL Low and uses Luna only by opt-in", () => {
  const small = decision("small_mechanical", .96, .96, .03, .01);
  assert.deepEqual(routeFromDecision(small), {
    model: "gpt-6-sol", effort: "low", reason: "luna_not_opted_in",
  });
  assert.deepEqual(routeFromDecision(small, { allowLuna: true }), {
    model: "gpt-6-luna", effort: "low", reason: "clear_small_mechanical",
  });
  assert.equal(routeFromDecision(decision("small_mechanical", .89, .89, .08, .03)).model, "gpt-6-sol");
  assert.equal(routeFromDecision(decision("small_mechanical", .92, .92, .02, .06)).effort, "high");
});

test("ordinary work uses SOL Medium; important and uncertain work uses SOL High", () => {
  assert.deepEqual(routeFromDecision(decision("ordinary", .9, .02, .9, .08)), {
    model: "gpt-6-sol", effort: "medium", reason: "ordinary",
  });
  assert.equal(routeFromDecision(decision("important_difficult_high_risk", .99, 0, .01, .99)).effort, "high");
  assert.equal(routeFromDecision(decision("ordinary", .7, .1, .7, .2)).effort, "high");
  assert.equal(routeFromDecision({ answers: { task_class: { type: "choice", choice: "gpt-6-astra" } } }).model, "gpt-6-sol");
});

test("rejects likely source, secrets, URLs, and long summaries", () => {
  for (const value of ["a", "x".repeat(241), "Fix this: const x = 1;", "token=reallysecretvalue", "Check https://example.com/test", "First line\nSecond line"]) {
    assert.throws(() => validateSummary(value));
  }
});

test("mocked request sends only the summary and returns a conservative result", async () => {
  const summary = "Improve the weekly planning flow";
  const calls = [];
  const route = await recommendRoute(summary, { apiKey: "test-only-key", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => decision("important_difficult_high_risk", .95, .01, .04, .95) };
  } });
  assert.equal(route.model, "gpt-6-sol");
  assert.deepEqual(route, { model: "gpt-6-sol", effort: "high", reason: "important_or_uncertain" });
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-only-key");
  assert.deepEqual(JSON.parse(calls[0].options.body).state, { task_summary: summary });
});

test("high-risk summary overrides a misleading small-task classification", async () => {
  let called = false;
  const route = await recommendRoute("Fix authentication behavior in production", {
    apiKey: "test-only-key",
    allowLuna: true,
    fetchImpl: async () => { called = true; return { ok: true, json: async () => decision("small_mechanical", .96, .96, .03, .01) }; },
  });
  assert.deepEqual(route, { model: "gpt-6-sol", effort: "high", reason: "high_risk_guard" });
  assert.equal(called, false);
});

test("API failure and missing credentials fail toward SOL High", async () => {
  assert.equal((await recommendRoute("Review a planning workflow", { apiKey: "" })).reason, "missing_api_key");
  const route = await recommendRoute("Review a planning workflow", { apiKey: "test-only-key", fetchImpl: async () => {
    throw new Error("secret header and task text could appear here");
  } });
  assert.deepEqual(route, { model: "gpt-6-sol", effort: "high", reason: "api_unavailable" });
});
