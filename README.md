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
| xAI (Grok) | `api.x.ai` | `grok-4.5`, `grok-4.3` |
| OpenRouter (any model) | `openrouter.ai` | `anthropic/claude-sonnet-5`, `openai/gpt-5.5`, `x-ai/grok-4.5`, `google/gemini-2.5-pro` |
| Custom (OpenAI-compatible) | your URL | Groq, DeepSeek, Together, local, … |

Every model field is editable — the presets are just starting points. Anthropic calls use the `anthropic-dangerous-direct-browser-access` header for CORS. If a provider blocks direct browser calls, use **OpenRouter** (one key reaches all of the above). Codex-class models (`gpt-5.x-codex`) are Responses-API-only and won't work through the chat endpoint — reach them via OpenRouter.

## Features

- **Generate** — 5 A/B title variants (scored, strategy-labeled), thumbnail overlays + art direction, SEO description, 3 hooks, tags/hashtags, publish window, pinned comment, and streaming short + long-form scripts with timecodes and B-roll cues.
- **Masterplan** — idea engine (niche → video ideas), content board with a status pipeline (Idea → Published), scheduling, and Markdown/JSON export. Persists in your browser.
- **A/B Lab** — two-proportion z-test on impressions/clicks to call a title winner with confidence and p-value, plus a thumbnail packaging scorecard.
- **Toolkit** — live keyword/hashtag + content-pillar research, description template, CTA library, and a cadence reference.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the built site
```

## Deploy (GitHub Pages)

Deployment is automated via `.github/workflows/deploy.yml` on every push to `main`.

One-time setup: in the repo, go to **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. The Vite `base` is set to `/studioplan/` in `vite.config.js` — if you rename the repo, update it to match.

## Stack

React 18 · Vite 5 · Tailwind CSS 3 · lucide-react · provider-agnostic BYOK LLM client (`src/llm.js`).

## Note on keys

Your API key is visible to anyone with access to your browser/device and is used for calls you initiate. Treat this like any other client-side BYOK tool: use a key scoped/limited to your own use, and revoke it if shared. StudioPlan never transmits your key anywhere except the provider you select.

## License

MIT.
