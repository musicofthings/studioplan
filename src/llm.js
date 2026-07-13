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
    // Model codes from https://ai.google.dev/gemini-api/docs/models (text generateContent only).
    // Stable first, then preview. Image/Live/TTS/Veo models are intentionally omitted.
    models: [
      "gemini-3.5-flash", // stable — frontier Flash
      "gemini-3.1-flash-lite", // stable — cheapest/fastest 3.x
      "gemini-2.5-pro", // stable — deep reasoning
      "gemini-2.5-flash", // stable — price/performance
      "gemini-2.5-flash-lite", // stable — high-volume / low cost
      "gemini-3.1-pro-preview", // preview — most capable 3.x Pro
      "gemini-3-flash-preview", // preview — multimodal Flash
    ],
    note:
      "Uses native generateContent. Model codes match Google’s docs (ai.google.dev/gemini-api/docs/models). Create a key in AI Studio. 403 → fix Application restrictions (allow your site origin) or set to None for local testing. gemini-2.0-flash is shut down — do not use it.",
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
    // Always use max_tokens (OpenRouter's primary param). Cap so low-balance keys
    // don't fail with "requires more credits, or fewer max_tokens" (OR reserves
    // against the full ceiling even if the model outputs less).
    tokenParam: "max_tokens",
    maxOutputCap: 6000,
    models: [
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash-lite",
      "google/gemini-3-flash-preview",
      "x-ai/grok-4.5",
      "x-ai/grok-4.3",
      "x-ai/grok-4-1-fast",
      "anthropic/claude-sonnet-4",
      "openai/gpt-4o",
      "deepseek/deepseek-chat",
    ],
    extraHeaders: () => ({
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://musicofthings.github.io",
      "X-Title": "StudioPlan",
    }),
    note:
      "One key for Gemini, Grok, Claude, GPT, etc. OpenRouter reserves credits against max_tokens — StudioPlan caps output at 6k tokens per call to avoid “fewer max_tokens” errors. If you still see that, add credits at openrouter.ai/credits or pick a cheaper model. Edit the model field for any OpenRouter slug.",
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

function isBillingOrQuotaError(detail) {
  if (!detail) return false;
  return /credit|credits|billing|spending limit|spend limit|quota|insufficient|payment|out of funds|usage limit|monthly limit|rate.?limit|fewer max_tokens|can only afford|requires more credits/i.test(
    detail
  );
}

function isOpenRouterTokenAffordabilityError(detail) {
  if (!detail) return false;
  return /fewer max_tokens|can only afford|requires more credits.*max_tokens|max_tokens.*afford/i.test(
    detail
  );
}

/** Clamp requested completion tokens for providers that reserve balance against the ceiling. */
export function clampMaxTokens(requested, providerCfg) {
  const n = Math.max(1, Math.floor(Number(requested) || 4096));
  const cap = providerCfg?.maxOutputCap;
  if (cap != null && Number.isFinite(cap) && cap > 0) return Math.min(n, cap);
  return n;
}

function isAuthOrOriginError(detail) {
  if (!detail) return true;
  return /api.?key|unauthorized|forbidden|referer|referrer|origin|cors|invalid.?key|permission|not allowed/i.test(
    detail
  );
}

/**
 * Build a user-facing error from an HTTP error response.
 * Prefer provider billing/quota text over a generic 403/CORS message.
 */
async function errText(res) {
  // Read the body once — re-reading after res.json() fails is unreliable in browsers.
  const raw = await res.text().catch(() => "");
  let detail = raw.slice(0, 400);
  try {
    const j = JSON.parse(raw);
    // OpenAI / xAI / OpenRouter: { error: { message } } or { error: "string" }
    if (typeof j.error === "string") detail = j.error;
    else if (j.error && typeof j.error === "object") {
      detail = j.error.message || j.error.code || JSON.stringify(j.error).slice(0, 300);
    } else if (j.message) detail = j.message;
    else detail = JSON.stringify(j).slice(0, 300);
  } catch {
    /* keep raw slice */
  }
  detail = String(detail || "").trim();

  // OpenRouter: high max_tokens fails when balance can't cover the reserved ceiling
  if (isOpenRouterTokenAffordabilityError(detail)) {
    return (
      "OpenRouter token/credit limit (" +
      res.status +
      "): " +
      detail +
      " OpenRouter reserves balance for the full max_tokens ceiling. Add credits at openrouter.ai/credits, or use a cheaper model. StudioPlan already caps output per call."
    );
  }

  // Billing / credits / spending limits (xAI often returns these as 403)
  if (isBillingOrQuotaError(detail)) {
    return (
      "Provider billing/quota (" +
      res.status +
      "): " +
      detail +
      " Add credits or raise the spending limit in the provider console, or switch providers in Settings."
    );
  }

  // True auth / key / browser-origin issues
  if ((res.status === 401 || res.status === 403) && isAuthOrOriginError(detail)) {
    return (
      "Rejected (" +
      res.status +
      "). Check the API key in Settings. " +
      "Common causes: wrong key, key restrictions (HTTP referrer / IP), or the provider blocking browser origins. " +
      "Workaround: use OpenRouter." +
      (detail ? " Details: " + detail : "")
    );
  }

  if (res.status === 401 || res.status === 403) {
    return (
      "Rejected (" +
      res.status +
      ")" +
      (detail ? ": " + detail : ".") +
      " Check Settings or the provider console."
    );
  }

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
  const tokens = clampMaxTokens(maxTokens, p);

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
          max_tokens: tokens,
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
      const outTokens = Math.max(tokens, 8192);
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
      // Do NOT send temperature here. Newer OpenAI models (e.g. gpt-5.6-terra) only
      // allow the default (1); sending 0.7 returns 400 Unsupported value.
      // Providers that support custom temp still use their API default without this field.
      // OpenRouter / OpenAI-compat: only set the configured token field (never both).
      body[p.tokenParam || "max_tokens"] = tokens;
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

  const choice = data.choices && data.choices[0];
  const text = extractOpenAIContent(choice && choice.message);
  // OpenRouter / OpenAI finish_reason "length" means we hit max_tokens — surface it
  // so incomplete blueprints aren't mistaken for parse bugs.
  if (choice && choice.finish_reason === "length" && text) {
    // Still return usable text; caller JSON parse may fail on truncated blueprints.
    // Prefix is avoided so JSON tasks still try to parse. Warn only if clearly non-JSON.
    if (!/^\s*[\[{]/.test(text)) {
      return (
        text +
        "\n\n[StudioPlan note: output stopped at the token limit. Retry scripts, use a model with higher output, or generate Long alone.]"
      );
    }
  }
  if (choice && choice.finish_reason === "length" && !text) {
    throw new Error(
      "Model hit the max token limit before producing text (often reasoning models). Try google/gemini-2.5-flash or raise credits so a higher ceiling is allowed."
    );
  }
  return text;
}
