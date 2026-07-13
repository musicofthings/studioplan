import { describe, it, expect, vi, afterEach } from "vitest";
import { llm, PROVIDERS, clampMaxTokens } from "./llm";

describe("PROVIDERS", () => {
  it("includes gemini with official model codes from Google docs", () => {
    expect(PROVIDERS.gemini.kind).toBe("gemini");
    // Stable text models (https://ai.google.dev/gemini-api/docs/models)
    expect(PROVIDERS.gemini.models).toContain("gemini-3.5-flash");
    expect(PROVIDERS.gemini.models).toContain("gemini-3.1-flash-lite");
    expect(PROVIDERS.gemini.models).toContain("gemini-2.5-pro");
    expect(PROVIDERS.gemini.models).toContain("gemini-2.5-flash");
    expect(PROVIDERS.gemini.models).toContain("gemini-2.5-flash-lite");
    // Preview text models
    expect(PROVIDERS.gemini.models).toContain("gemini-3.1-pro-preview");
    expect(PROVIDERS.gemini.models).toContain("gemini-3-flash-preview");
    // Shut down — must not be offered
    expect(PROVIDERS.gemini.models).not.toContain("gemini-2.0-flash");
    expect(PROVIDERS.gemini.models).not.toContain("gemini-2.0-flash-lite");
  });

  it("includes current Grok chat models", () => {
    expect(PROVIDERS.xai.models).toContain("grok-4.5");
    expect(PROVIDERS.xai.models).toContain("grok-4.3");
    expect(PROVIDERS.xai.models).toContain("grok-4.20-0309-reasoning");
  });

  it("lists Gemini and Grok on OpenRouter", () => {
    expect(PROVIDERS.openrouter.models.some((m) => m.startsWith("google/gemini"))).toBe(true);
    expect(PROVIDERS.openrouter.models.some((m) => m.startsWith("x-ai/grok"))).toBe(true);
  });
});

describe("llm gemini path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls generateContent with x-goog-api-key and extracts text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ thought: true, text: "thinking..." }, { text: "Hello from Gemini" }],
            },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await llm("hi", "sys", {
      provider: "gemini",
      key: "AIza-test",
      model: "gemini-2.5-flash",
    });

    expect(out).toBe("Hello from Gemini");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/models/gemini-2.5-flash:generateContent");
    expect(opts.headers["x-goog-api-key"]).toBe("AIza-test");
    const body = JSON.parse(opts.body);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.contents[0].parts[0].text).toBe("hi");
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
  });

  it("surfaces 403 with restriction/OpenRouter guidance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: "Requests from referer are blocked." } }),
      })
    );

    await expect(
      llm("hi", "sys", { provider: "gemini", key: "AIza-bad", model: "gemini-2.5-flash" })
    ).rejects.toThrow(/403|OpenRouter|referrer|restrictions/i);
  });

  it("surfaces xAI credit/spending-limit 403 as billing, not CORS", async () => {
    const msg =
      "Your team c0c3d2eb has either used all available credits or reached its monthly spending limit. To continue making API requests, please purchase more credits or raise your spending limit.";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: msg } }),
      })
    );

    const err = await llm("hi", "sys", {
      provider: "xai",
      key: "xai-test",
      model: "grok-4.5",
    }).then(
      () => {
        throw new Error("expected llm to reject");
      },
      (e) => e
    );
    expect(err.message).toMatch(/billing\/quota|spending limit|purchase more credits/i);
    expect(err.message).not.toMatch(/CORS|referrer/i);
  });
});

describe("clampMaxTokens / OpenRouter", () => {
  it("caps OpenRouter output at maxOutputCap", () => {
    expect(clampMaxTokens(8000, PROVIDERS.openrouter)).toBe(6000);
    expect(clampMaxTokens(2000, PROVIDERS.openrouter)).toBe(2000);
    expect(PROVIDERS.openrouter.tokenParam).toBe("max_tokens");
    expect(PROVIDERS.openrouter.maxOutputCap).toBe(6000);
  });

  it("does not cap providers without maxOutputCap", () => {
    expect(clampMaxTokens(8000, PROVIDERS.xai)).toBe(8000);
  });

  it("sends max_tokens (not max_completion_tokens) for OpenRouter", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await llm("hi", "sys", {
      provider: "openrouter",
      key: "sk-or-test",
      model: "google/gemini-2.5-flash",
    }, 8000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(6000);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.model).toBe("google/gemini-2.5-flash");
  });

  it("explains OpenRouter fewer-max_tokens credit errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        text: async () =>
          JSON.stringify({
            error: {
              message:
                "This request requires more credits, or fewer max_tokens. You requested up to 8000 tokens, but can only afford 1200.",
            },
          }),
      })
    );

    await expect(
      llm("hi", "sys", {
        provider: "openrouter",
        key: "sk-or-test",
        model: "google/gemini-2.5-flash",
      }, 8000)
    ).rejects.toThrow(/OpenRouter token\/credit|fewer max_tokens|openrouter\.ai\/credits/i);
  });
});

describe("llm openai-compatible content", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts string content from Grok/OpenAI responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { role: "assistant", content: "Grok says hi" } }],
        }),
      })
    );

    const out = await llm("hi", "sys", {
      provider: "xai",
      key: "xai-test",
      model: "grok-4.5",
    });
    expect(out).toBe("Grok says hi");
  });
});
