// Multi-provider, bring-your-own-key LLM client.
// Runs entirely in the browser: keys live in localStorage and go straight to the provider.

export const PROVIDERS = {
  anthropic: {
    label: "Anthropic — Claude",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001", "claude-fable-5"],
  },
  openai: {
    label: "OpenAI — GPT / Codex",
    kind: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
    tokenParam: "max_completion_tokens",
    models: ["gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-4.1", "gpt-4o"],
    note: "Codex-class models (gpt-5.x-codex) are Responses-API only — reach them via OpenRouter. Direct browser calls may be blocked by CORS; use OpenRouter if you see network errors.",
  },
  gemini: {
    label: "Google — Gemini",
    kind: "gemini",
    // Native generateContent (more reliable than the OpenAI-compat shim from the browser).
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/apikey",
    models: [
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ],
    note:
      "Uses the native Gemini generateContent API. Create a key in Google AI Studio. If you get 403, open the key → Application restrictions and allow your site origin (e.g. https://musicofthings.github.io/*) or use “None” for local testing. Model ids change — edit the field if a preset 404s.",
  },
  xai: {
    label: "xAI — Grok",
    kind: "openai",
    endpoint: "https://api.x.ai/v1/chat/completions",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai/",
    models: [
      "grok-4.5",
      "grok-4.3",
      "grok-4.20-0309-reasoning",
      "grok-4.20-0309-non-reasoning",
      "grok-4-1-fast",
    ],
    note:
      "Direct browser calls to api.x.ai often fail with CORS or 403. Prefer OpenRouter with slugs like x-ai/grok-4.5 if you hit that. Keys come from console.x.ai; ensure chat API access is enabled on the key.",
  },
  openrouter: {
    label: "OpenRouter — any model",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-flash-lite",
      "x-ai/grok-4.5",
      "x-ai/grok-4.3",
      "x-ai/grok-4-1-fast",
      "anthropic/claude-sonnet-5",
      "openai/gpt-5.5",
      "deepseek/deepseek-chat",
    ],
    extraHeaders: () => ({ "HTTP-Referer": window.location.origin, "X-Title": "StudioPlan" }),
    note: "One key reaches Gemini, Grok, Claude, GPT and 300+ others. Best path when a provider blocks direct browser calls (CORS/403).",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    kind: "openai",
    endpoint: "",
    editableEndpoint: true,
    keyHint: "your key",
    models: [],
    note: "Point at any OpenAI-compatible /chat/completions endpoint — Groq, DeepSeek, Together, a local server, Gemini OpenAI-compat (https://generativelanguage.googleapis.com/v1beta/openai/chat/completions), etc.",
  },
};

function authHint(status, detail) {
  if (status === 401 || status === 403) {
    const base =
      "Rejected (" +
      status +
      "). Check the API key in Settings. " +
      "Common causes: wrong key, key restrictions (HTTP referrer / IP), or the provider blocking browser origins. " +
      "Workaround: use OpenRouter.";
    return detail ? base + " Details: " + detail : base;
  }
  return null;
}

async function errText(res) {
  // Read the body once — re-reading after res.json() fails is unreliable in browsers.
  const raw = await res.text().catch(() => "");
  let detail = raw.slice(0, 280);
  try {
    const j = JSON.parse(raw);
    detail =
      (j.error && (j.error.message || j.error.status)) ||
      j.message ||
      JSON.stringify(j.error || j).slice(0, 240);
  } catch {
    /* keep raw slice */
  }
  const auth = authHint(res.status, detail);
  if (auth) return auth;
  return "Provider error " + res.status + (detail ? ": " + detail : "");
}

/** Extract text from OpenAI-style message.content (string or multimodal parts). */
function extractOpenAIContent(msg) {
  if (!msg) return "";
  const c = msg.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) {
    return c
      .map((p) => (typeof p === "string" ? p : p?.text || p?.content || ""))
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

/** Extract text from Gemini generateContent response (skip thought parts). */
function extractGeminiText(data) {
  const feedback = data?.promptFeedback;
  if (feedback?.blockReason) {
    throw new Error("Gemini blocked the prompt (" + feedback.blockReason + "). Try rephrasing or a different model.");
  }
  const cand = data?.candidates?.[0];
  if (!cand) {
    const reason = data?.error?.message || "No candidates returned.";
    throw new Error("Gemini returned no content: " + reason);
  }
  if (cand.finishReason === "SAFETY") {
    throw new Error("Gemini finished with SAFETY block. Try a different prompt or model.");
  }
  const parts = cand.content?.parts || [];
  const text = parts
    .filter((p) => p && p.text && !p.thought)
    .map((p) => p.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Gemini returned empty text (model may have used only thinking tokens — try a higher max or gemini-2.5-flash).");
  return text;
}

/**
 * @param {string} prompt
 * @param {string} system
 * @param {{ provider: string, key: string, model: string, endpoint?: string }} cfg
 * @param {number} [maxTokens]
 * @param {AbortSignal} [signal]
 */
export async function llm(prompt, system, cfg, maxTokens = 4096, signal) {
  const p = PROVIDERS[cfg.provider];
  if (!p) throw new Error("Unknown provider.");
  if (!cfg.key) throw new Error("Add an API key for " + p.label + " in Settings.");
  const endpoint = cfg.endpoint || p.endpoint;
  if (!endpoint) throw new Error("Set the API endpoint in Settings.");

  let res;
  try {
    if (p.kind === "anthropic") {
      res = await fetch(endpoint, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
    } else if (p.kind === "gemini") {
      // Native Gemini API — works from the browser with an AI Studio key.
      // Prefer x-goog-api-key header (query-string keys also work but are noisier in logs).
      const base = endpoint.replace(/\/$/, "");
      const url = `${base}/models/${encodeURIComponent(cfg.model)}:generateContent`;
      // Thinking models spend output budget on thoughts; give headroom for long scripts.
      const outTokens = Math.max(maxTokens, 8192);
      res = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": cfg.key,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: outTokens,
            temperature: 0.7,
          },
        }),
      });
    } else {
      const headers = { "content-type": "application/json", Authorization: "Bearer " + cfg.key };
      if (p.extraHeaders) Object.assign(headers, p.extraHeaders());
      const body = {
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      };
      body[p.tokenParam || "max_tokens"] = maxTokens;
      res = await fetch(endpoint, { method: "POST", signal, headers, body: JSON.stringify(body) });
    }
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error(
      "Network/CORS error reaching " +
        p.label +
        ". Many providers block browser origins. Switch to OpenRouter (one key for Gemini, Grok, Claude, GPT) or use a Custom endpoint that allows CORS."
    );
  }

  if (!res.ok) throw new Error(await errText(res));
  const data = await res.json();

  if (p.kind === "anthropic") {
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }
  if (p.kind === "gemini") {
    return extractGeminiText(data);
  }
  return extractOpenAIContent(data.choices && data.choices[0] && data.choices[0].message);
}
