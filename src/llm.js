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
    note: "Codex-class models (gpt-5.x-codex) are Responses-API only and won't work through this chat endpoint — reach them via OpenRouter (slug openai/gpt-5.3-codex).",
  },
  xai: {
    label: "xAI — Grok",
    kind: "openai",
    endpoint: "https://api.x.ai/v1/chat/completions",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai/",
    models: ["grok-4.5", "grok-4.3", "grok-4-1-fast"],
  },
  openrouter: {
    label: "OpenRouter — any model",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      "anthropic/claude-sonnet-5",
      "openai/gpt-5.5",
      "x-ai/grok-4.5",
      "google/gemini-2.5-pro",
      "deepseek/deepseek-chat",
    ],
    extraHeaders: () => ({ "HTTP-Referer": window.location.origin, "X-Title": "StudioPlan" }),
    note: "One key reaches Claude, GPT, Grok, Gemini and 300+ others. Best fallback when a provider blocks direct browser calls.",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    kind: "openai",
    endpoint: "",
    editableEndpoint: true,
    keyHint: "your key",
    models: [],
    note: "Point at any OpenAI-compatible /chat/completions endpoint — Groq, DeepSeek, Together, a local server, etc.",
  },
};

async function errText(res) {
  let detail = "";
  try {
    const j = await res.json();
    detail = (j.error && j.error.message) || JSON.stringify(j.error || j).slice(0, 200);
  } catch {
    detail = await res.text().catch(() => "");
  }
  if (res.status === 401 || res.status === 403) return "Rejected (" + res.status + "). Check the API key in Settings.";
  return "Provider error " + res.status + (detail ? ": " + detail : "");
}

export async function llm(prompt, system, cfg, maxTokens = 4096) {
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
      res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    }
  } catch (e) {
    throw new Error(
      "Network/CORS error reaching " + p.label + ". If it persists, use OpenRouter as the provider."
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
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  return ((msg && msg.content) || "").trim();
}
