import { describe, it, expect, vi, afterEach } from "vitest";
import { llm, PROVIDERS } from "./llm";

describe("PROVIDERS", () => {
  it("includes gemini with native kind and current models", () => {
    expect(PROVIDERS.gemini.kind).toBe("gemini");
    expect(PROVIDERS.gemini.models).toContain("gemini-2.5-pro");
    expect(PROVIDERS.gemini.models).toContain("gemini-3.5-flash");
    expect(PROVIDERS.gemini.models).toContain("gemini-2.5-flash");
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
