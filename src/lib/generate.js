import { parseJSON } from "./parseJSON";
import { normalizeBlueprint, normalizeIdeas, normalizeToolkit } from "./normalize";

const STRATEGIST =
  "You are a world-class YouTube growth strategist and scriptwriter who has packaged and scripted videos for channels past several million subscribers. You have deep command of hooks, audience retention, packaging (title + thumbnail as a pair), YouTube SEO and the current recommendation algorithm. You write specifically for the creator's stated niche, tone and audience. Be concrete, punchy and non-generic. When asked for JSON, return ONLY valid JSON with no markdown fences and no commentary.";

function ctx(f) {
  return (
    `Topic / idea: ${f.topic}\n` +
    `Channel niche: ${f.niche || "general creator"}\n` +
    `Voice / tone: ${f.tone}\n` +
    `Target audience: ${f.audience || "broad YouTube audience"}\n` +
    `Priority keywords: ${f.keywords || "(none specified)"}`
  );
}

/** ask(prompt, system, maxTokens) — provided by the app (wraps llm + abort). */
export async function genBlueprint(ask, f) {
  const prompt =
    ctx(f) +
    `\n\nProduce a complete YouTube packaging blueprint. Return ONLY this JSON:\n` +
    `{\n` +
    `  "titles": [ {"style":"Curiosity gap","text":"<= 60 chars","score": <1-10 CTR potential>}, {"style":"Big outcome"...}, {"style":"How-to"...}, {"style":"Contrarian"...}, {"style":"Number/list"...} ],\n` +
    `  "description": "150-280 word SEO description. First two lines must earn the click in search. Include a [links here] and [00:00 timestamps here] placeholder. Keyword rich, natural.",\n` +
    `  "tags": ["10-15 concise search tags"],\n` +
    `  "hashtags": ["#3to5", "#relevant"],\n` +
    `  "thumbnail": {"overlays": ["<=4 words","alt option","alt option"], "visual": "one sentence art direction: subject, expression, colour, composition"},\n` +
    `  "hooks": ["3 spoken opening hooks, first 5-10 seconds, each a different angle"],\n` +
    `  "cta": ["2 calls to action tuned to this video"],\n` +
    `  "postingTime": "best day + time window to publish for this niche/audience, one line with the why",\n` +
    `  "pinnedComment": "a pinned comment that drives engagement",\n` +
    `  "chapters": [ {"time":"0:00","title":"Cold open"}, ... 6-9 chapters for the long-form cut ]\n` +
    `}`;
  // Token budgets stay moderate so OpenRouter credit-reservation (max_tokens ceiling) succeeds.
  return normalizeBlueprint(parseJSON(await ask(prompt, STRATEGIST, 3500)));
}

export async function genShort(ask, f) {
  const prompt =
    ctx(f) +
    `\n\nWrite a vertical YouTube SHORT script, 30-55 seconds. Requirements: a 2-second visual + spoken hook that stops the scroll, fast pacing with a pattern interrupt, a subtle loop so it replays, and a clear end CTA. Format in markdown using [0:00] timecodes, spoken lines, and (on-screen: ...) / [b-roll: ...] cue lines. No preamble.`;
  return ask(prompt, STRATEGIST, 2500);
}

export async function genLong(ask, f, chapters) {
  const chapStr = (chapters || [])
    .map((c) => `${c.time} ${c.title}`)
    .join(" | ");
  const prompt =
    ctx(f) +
    `\n\nChapters to follow: ${chapStr || "(design your own 6-9 chapters)"}\n\n` +
    `Write a full long-form YouTube script (~6-9 minutes). Include: a cold-open hook (0-15s) that states the promise, an intro that builds why-watch + credibility, the chaptered body, an open loop / re-hook roughly every 60-90 seconds to hold retention, [VISUAL:] and [B-ROLL:] cue lines, and an outro with the CTA plus a tease to the next video. Use markdown with ## chapter headers and timecodes. Write real spoken lines, not an outline. Aim for a complete script that fits a tight token budget — be punchy, not padded.`;
  // Capped at 6000 so OpenRouter (maxOutputCap 6000) and low-credit accounts don't reject the request.
  return ask(prompt, STRATEGIST, 6000);
}

export async function genIdeas(ask, niche, count) {
  const prompt =
    `Channel niche: ${niche}\n\nGenerate ${count} high-potential YouTube video ideas for this niche. Mix searchable "how-to" ideas with a few bold browse/viral swings. Return ONLY JSON: [ {"title":"working title","angle":"one line on why it works / the hook","format":"long" or "short"} ]`;
  return normalizeIdeas(parseJSON(await ask(prompt, STRATEGIST, 1800)));
}

export async function genToolkit(ask, niche) {
  const prompt =
    `Channel niche: ${niche}\n\nReturn ONLY JSON with fields:\n{\n "hashtags": ["12-16 relevant hashtags"],\n "seoKeywords": ["12-16 search keywords/phrases people actually type"],\n "relatedSearches": ["8 adjacent search queries to make videos about"],\n "contentPillars": [ {"name":"pillar","description":"what it covers and why it retains this audience"} x4-5 ]\n}`;
  return normalizeToolkit(parseJSON(await ask(prompt, STRATEGIST, 1800)));
}
