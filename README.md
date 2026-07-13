# StudioPlan

A bring-your-own-key YouTube content masterplan engine. One idea in → full packaging out: A/B-ready titles, thumbnail concepts, SEO description, hooks, tags, and complete short + long-form scripts — plus an A/B testing lab and a reusable marketing toolkit. Runs fully in the browser and deploys as a static site to GitHub Pages.

**Live:** https://musicofthings.github.io/studioplan/

## How it works

StudioPlan is a static React app — there is **no backend**. You paste your own provider API key into Settings; it's stored in your browser (`localStorage`) and sent **directly** from your browser to the provider you choose. Nothing goes through any StudioPlan server.

### Supported providers

| Provider | Endpoint | Example models |
|---|---|---|
| Anthropic (Claude) | `api.anthropic.com` | `claude-sonnet-5`, `claude-opus-4-8` |
| OpenAI (GPT / Codex) | `api.openai.com` | `gpt-5.5`, `gpt-5.6-terra`, `gpt-4.1` |
| **Google (Gemini)** | `generativelanguage.googleapis.com` (native `generateContent`) | `gemini-3.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| **xAI (Grok)** | `api.x.ai` | `grok-4.5`, `grok-4.3`, `grok-4.20-0309-reasoning`, `grok-4-1-fast` |
| OpenRouter (any model) | `openrouter.ai` | `google/gemini-2.5-pro`, `x-ai/grok-4.5`, Claude, GPT, … |
| Custom (OpenAI-compatible) | your URL | Groq, DeepSeek, Together, Gemini OpenAI-compat, local, … |

Every model field is editable — the presets are just starting points (provider model ids change; if a call fails, verify the id in the provider console).

**Gemini** uses Google’s native `generateContent` API (not the OpenAI shim) with the `x-goog-api-key` header — this is the reliable path from a browser BYOK app. Get a key at [Google AI Studio](https://aistudio.google.com/apikey).

**403 / CORS troubleshooting**

| Symptom | Likely cause | Fix |
|---|---|---|
| Gemini **403** | API key **Application restrictions** (HTTP referrer) don’t include your site | In AI Studio / Cloud Console, set referrer to `https://musicofthings.github.io/*` (and `http://localhost:*` for dev) or temporarily **None** |
| xAI / OpenAI **network error or 403** | Provider blocks browser origins (CORS) | Use **OpenRouter** with `x-ai/grok-4.5` or `google/gemini-2.5-pro` |
| Wrong model id | Preset renamed upstream | Edit the Model field; pick a chip that matches the provider console |

Anthropic calls use the `anthropic-dangerous-direct-browser-access` header for CORS. Codex-class models (`gpt-5.x-codex`) are Responses-API-only — reach them via OpenRouter.

## Features

- **Generate** — 5 A/B title variants (scored, strategy-labeled), thumbnail overlays + art direction, SEO description, 3 hooks, tags/hashtags, publish window, pinned comment, and full short + long-form scripts with timecodes and B-roll cues. Generation can be **stopped**; if scripts fail after packaging, the blueprint stays on screen and you can **retry scripts only**.
- **Masterplan** — idea engine (niche → video ideas), content board with a status pipeline (Idea → Published), scheduling, delete confirmation, and Markdown/JSON export. Persists in your browser.
- **A/B Lab** — two-proportion z-test on impressions/clicks. Reports a winner only when **p &lt; 0.05** (does not misuse `1 − p` as “confidence”), with a small-sample warning and a thumbnail packaging scorecard.
- **Toolkit** — keyword/hashtag + content-pillar research, description template, CTA library, and a cadence reference.

## Project layout

```
src/
  StudioPlan.jsx       # App shell + tab views
  main.jsx             # React entry
  llm.js               # Multi-provider BYOK client (AbortSignal-aware)
  index.css
  components/ui.jsx    # Shared UI (CopyBtn, Section, Chip, …)
  lib/
    generate.js        # LLM prompts + gen helpers
    normalize.js       # Safe shapes for blueprint / ideas / toolkit
    parseJSON.js       # Fence-tolerant JSON parse
    stats.js           # erf, normCdf, two-proportion z-test
    utils.js           # copy, download, markdown export
    constants.js       # statuses, tones, templates
    *.test.js          # Vitest unit tests
```

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the built site
npm test         # unit tests (parseJSON, normalize, A/B stats)
```

## Deploy (GitHub Pages)

Deployment is automated via `.github/workflows/deploy.yml` on every push to `main`.

One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. The Vite `base` is set to `/studioplan/` in `vite.config.js` — if you rename the repo, update it to match.

## Stack

React 18 · Vite 5 · Tailwind CSS 3 · lucide-react · Vitest · provider-agnostic BYOK LLM client (`src/llm.js`).

## Note on keys

Your API key is visible to anyone with access to your browser/device and is used for calls you initiate. Treat this like any other client-side BYOK tool: use a key scoped/limited to your own use (spend caps where available), and revoke it if shared. StudioPlan never transmits your key anywhere except the provider you select.

## Changelog (recent)

### Providers — Gemini + Grok

- **Google Gemini** provider (native `generateContent`) with current models: `gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.0-flash`.
- **xAI Grok** presets updated: `grok-4.5`, `grok-4.3`, `grok-4.20-0309-reasoning`, `grok-4.20-0309-non-reasoning`, `grok-4-1-fast`.
- **OpenRouter** presets include Gemini + Grok slugs for a CORS-safe fallback.
- Clearer **401/403** messages (key restrictions, browser CORS) and provider notes pointing to OpenRouter when direct calls fail.

### Earlier reliability pass

- **A/B Lab stats** — significance at α = 0.05 and p-value only; removed incorrect “confidence = 1 − p” wording; low-sample warning.
- **Generation recovery** — keep partial blueprints visible after script failures; **Retry scripts only**; **Stop** cancels in-flight requests via `AbortSignal`.
- **LLM payload safety** — normalize blueprint / ideas / toolkit JSON before render so empty or partial model output cannot crash the UI.
- **Client robustness** — provider error bodies read once; clearer model-id guidance in Settings.
- **UX** — delete confirmation on board cards; Settings dialog Escape + `role="dialog"`; Copy button timer cleanup.
- **Structure** — pure helpers under `src/lib/`, shared UI under `src/components/`; removed unused root `StudioPlan.jsx`.
- **Tests** — Vitest coverage for `parseJSON`, `normalize*`, and `twoProportionZTest`.
- **Docs** — README no longer claims streaming scripts (generation is full-response, not token-streamed).

## License

MIT.
