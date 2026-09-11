import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({
  ENV: { aiApiKey: "test-provider-key", aiApiUrl: "https://provider.example.test" },
}));

import { invokeLLM } from "./llm";
import { ENV } from "./env";

describe("invokeLLM", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    ENV.aiApiUrl = "https://provider.example.test";
  });

  it.each([
    ["https://provider.example.test/v1", "https://provider.example.test/v1/chat/completions"],
    ["https://provider.example.test/api/v1/", "https://provider.example.test/api/v1/chat/completions"],
    ["https://provider.example.test/v1/chat/completions", "https://provider.example.test/v1/chat/completions"],
  ])("uses the explicit provider endpoint %s without duplicating its API version", async (base, endpoint) => {
    ENV.aiApiUrl = base;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await invokeLLM({ messages: [{ role: "user", content: "Draft a task" }] });
    expect(fetchMock.mock.calls[0][0]).toBe(endpoint);
  });

  it("sends max_completion_tokens for a GPT completion request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "reply-1", created: 1, model: "gpt-5-mini", choices: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({
      model: "gpt-5-mini",
      maxCompletionTokens: 520,
      messages: [{ role: "user", content: "Draft one task." }],
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({ model: "gpt-5-mini", max_completion_tokens: 520 });
    expect(payload.max_tokens).toBeUndefined();
  });
});
