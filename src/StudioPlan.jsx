import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles, Wand2, LayoutGrid, FlaskConical, Wrench, Play, Copy, Check,
  Download, Plus, Loader2, X, Youtube, Type, FileText, Hash, Image as ImageIcon,
  Clock, Target, Lightbulb, TrendingUp, MessageSquare, Trophy, ListChecks,
  RefreshCw, Trash2, Zap, Rocket, Film, Search, PenLine, ChevronRight,
  Settings as SettingsIcon, KeyRound, ExternalLink, AlertTriangle,
} from "lucide-react";
import { llm, PROVIDERS } from "./llm";

/* ------------------------------------------------------------------ */
/*  Claude (Sonnet) generation helpers                                 */
/* ------------------------------------------------------------------ */

function parseJSON(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const a = t.indexOf("[");
    const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
    const endObj = t.lastIndexOf("}");
    const endArr = t.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (start !== -1 && end !== -1) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Could not read a valid result.");
  }
}

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

async function genBlueprint(ask, f) {
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
  return parseJSON(await ask(prompt, STRATEGIST, 4096));
}

async function genShort(ask, f) {
  const prompt =
    ctx(f) +
    `\n\nWrite a vertical YouTube SHORT script, 30-55 seconds. Requirements: a 2-second visual + spoken hook that stops the scroll, fast pacing with a pattern interrupt, a subtle loop so it replays, and a clear end CTA. Format in markdown using [0:00] timecodes, spoken lines, and (on-screen: ...) / [b-roll: ...] cue lines. No preamble.`;
  return ask(prompt, STRATEGIST, 3000);
}

async function genLong(ask, f, chapters) {
  const chapStr = (chapters || [])
    .map((c) => `${c.time} ${c.title}`)
    .join(" | ");
  const prompt =
    ctx(f) +
    `\n\nChapters to follow: ${chapStr || "(design your own 6-9 chapters)"}\n\n` +
    `Write a full long-form YouTube script (~6-9 minutes). Include: a cold-open hook (0-15s) that states the promise, an intro that builds why-watch + credibility, the chaptered body, an open loop / re-hook roughly every 60-90 seconds to hold retention, [VISUAL:] and [B-ROLL:] cue lines, and an outro with the CTA plus a tease to the next video. Use markdown with ## chapter headers and timecodes. Write real spoken lines, not an outline.`;
  return ask(prompt, STRATEGIST, 8000);
}

async function genIdeas(ask, niche, count) {
  const prompt =
    `Channel niche: ${niche}\n\nGenerate ${count} high-potential YouTube video ideas for this niche. Mix searchable "how-to" ideas with a few bold browse/viral swings. Return ONLY JSON: [ {"title":"working title","angle":"one line on why it works / the hook","format":"long" or "short"} ]`;
  return parseJSON(await ask(prompt, STRATEGIST, 2000));
}

async function genToolkit(ask, niche) {
  const prompt =
    `Channel niche: ${niche}\n\nReturn ONLY JSON with fields:\n{\n "hashtags": ["12-16 relevant hashtags"],\n "seoKeywords": ["12-16 search keywords/phrases people actually type"],\n "relatedSearches": ["8 adjacent search queries to make videos about"],\n "contentPillars": [ {"name":"pillar","description":"what it covers and why it retains this audience"} x4-5 ]\n}`;
  return parseJSON(await ask(prompt, STRATEGIST, 2000));
}

/* ------------------------------------------------------------------ */
/*  Small utilities                                                    */
/* ------------------------------------------------------------------ */

function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText)
      return navigator.clipboard.writeText(text);
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

function download(name, text, type = "text/markdown") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return s * y;
}
const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

function videoToMarkdown(v) {
  let m = `# ${v.topic}\n\n`;
  m += `**Niche:** ${v.niche || "—"}  |  **Tone:** ${v.tone}  |  **Status:** ${v.status}\n\n`;
  if (v.titles) {
    m += `## Title options (A/B)\n`;
    v.titles.forEach((t) => (m += `- **[${t.style} · ${t.score}/10]** ${t.text}\n`));
    m += `\n`;
  }
  if (v.thumbnail) {
    m += `## Thumbnail\n- Overlay text: ${v.thumbnail.overlays.join(" / ")}\n- Direction: ${v.thumbnail.visual}\n\n`;
  }
  if (v.hooks) m += `## Hooks\n${v.hooks.map((h) => `- ${h}`).join("\n")}\n\n`;
  if (v.description) m += `## Description\n${v.description}\n\n`;
  if (v.tags) m += `## Tags\n${v.tags.join(", ")}\n\n`;
  if (v.hashtags) m += `## Hashtags\n${v.hashtags.join(" ")}\n\n`;
  if (v.cta) m += `## CTAs\n${v.cta.map((c) => `- ${c}`).join("\n")}\n\n`;
  if (v.postingTime) m += `## Publish window\n${v.postingTime}\n\n`;
  if (v.pinnedComment) m += `## Pinned comment\n${v.pinnedComment}\n\n`;
  if (v.shortScript) m += `## Short script\n${v.shortScript}\n\n`;
  if (v.longScript) m += `## Long-form script\n${v.longScript}\n\n`;
  return m;
}

const STATUSES = ["Idea", "Scripted", "Filming", "Scheduled", "Published"];
const STATUS_COLOR = {
  Idea: "#8b8b95",
  Scripted: "#4234c7",
  Filming: "#f2a413",
  Scheduled: "#0d8a6a",
  Published: "#e5342b",
};
const TONES = [
  "Energetic & punchy",
  "Calm & authoritative",
  "Curious & nerdy",
  "Warm & conversational",
  "Bold & contrarian",
  "Cinematic & dramatic",
];

/* ------------------------------------------------------------------ */
/*  Reusable UI primitives                                             */
/* ------------------------------------------------------------------ */

function CopyBtn({ text, label = "Copy", small }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await copyText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className={
        "inline-flex items-center gap-1.5 rounded-lg border border-[#e7e6e1] bg-white text-[#3a3a44] hover:border-[#c9c8c2] hover:text-[#17171c] transition " +
        (small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm")
      }
    >
      {done ? <Check size={13} className="text-[#0d8a6a]" /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

function Section({ icon: Icon, title, right, children }) {
  return (
    <div className="rounded-2xl border border-[#e7e6e1] bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0efea]">
        <div className="flex items-center gap-2 text-[#17171c]">
          <Icon size={16} className="text-[#e5342b]" />
          <span className="sp-display text-[15px] font-semibold tracking-tight">{title}</span>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Chip({ children, tone = "ink" }) {
  const map = {
    ink: "bg-[#f4f4f2] text-[#3a3a44] border-[#e7e6e1]",
    red: "bg-[#fdeceb] text-[#c02a20] border-[#f6d3cf]",
    indigo: "bg-[#eeecfb] text-[#3a2fb5] border-[#dcd8f6]",
  };
  return (
    <span className={"sp-mono inline-block rounded-md border px-2 py-0.5 text-[11px] " + map[tone]}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main app                                                           */
/* ------------------------------------------------------------------ */

export default function StudioPlan() {
  const [tab, setTab] = useState("generate");
  const [videos, setVideos] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem("studioplan.videos"));
      if (Array.isArray(v)) return v;
    } catch {}
    return [];
  });
  const [drawerId, setDrawerId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("studioplan.settings"));
      if (s && s.provider) return { keys: {}, endpoint: "", ...s };
    } catch {}
    return { provider: "anthropic", model: PROVIDERS.anthropic.models[0], endpoint: "", keys: {} };
  });
  useEffect(() => {
    try { localStorage.setItem("studioplan.videos", JSON.stringify(videos)); } catch {}
  }, [videos]);
  useEffect(() => {
    try { localStorage.setItem("studioplan.settings", JSON.stringify(settings)); } catch {}
  }, [settings]);

  const activeKey = settings.keys[settings.provider] || "";
  const hasKey = !!activeKey && (settings.provider !== "custom" || !!settings.endpoint);
  const ask = (prompt, system, maxTokens) =>
    llm(prompt, system, { provider: settings.provider, key: activeKey, model: settings.model, endpoint: settings.endpoint }, maxTokens);

  const [form, setForm] = useState({
    topic: "",
    niche: "",
    tone: TONES[0],
    audience: "",
    keywords: "",
    format: "both",
  });
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [gen, setGen] = useState({ loading: false, step: "", error: "", id: null });

  const updateVideo = (id, patch) =>
    setVideos((vs) => vs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function handleGenerate(override) {
    const f = override ? { ...form, ...override } : form;
    if (!f.topic.trim()) {
      setGen((g) => ({ ...g, error: "Add a topic or idea first." }));
      return;
    }
    if (!hasKey) {
      setShowSettings(true);
      setGen((g) => ({ ...g, error: "Add your API key in Settings to start generating." }));
      return;
    }
    if (override) setForm((s) => ({ ...s, ...override }));
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    setGen({ loading: true, step: "Packaging titles, description & SEO…", error: "", id });
    try {
      const bp = await genBlueprint(ask, f);
      const base = {
        id,
        topic: f.topic,
        niche: f.niche,
        tone: f.tone,
        format: f.format,
        status: "Scripted",
        scheduledDate: "",
        createdAt: Date.now(),
        ...bp,
        shortScript: "",
        longScript: "",
      };
      setVideos((vs) => [base, ...vs]);

      if (f.format === "long" || f.format === "both") {
        setGen((g) => ({ ...g, step: "Writing the long-form script…" }));
        const long = await genLong(ask, f, bp.chapters);
        updateVideo(id, { longScript: long });
      }
      if (f.format === "short" || f.format === "both") {
        setGen((g) => ({ ...g, step: "Writing the Short script…" }));
        const short = await genShort(ask, f);
        updateVideo(id, { shortScript: short });
      }
      setGen({ loading: false, step: "", error: "", id });
    } catch (e) {
      setGen({ loading: false, step: "", error: e.message || "Something went wrong. Try again.", id: null });
    }
  }

  const currentVideo = videos.find((v) => v.id === gen.id) || null;
  const drawerVideo = videos.find((v) => v.id === drawerId) || null;

  const NAV = [
    { id: "generate", label: "Generate", icon: Wand2 },
    { id: "masterplan", label: "Masterplan", icon: LayoutGrid },
    { id: "abtest", label: "A/B Lab", icon: FlaskConical },
    { id: "toolkit", label: "Toolkit", icon: Wrench },
  ];

  /* ------------------------------ Generate view ------------------------------ */
  function renderGenerate() {
    const field =
      "w-full rounded-xl border border-[#e7e6e1] bg-white px-3.5 py-2.5 text-sm text-[#17171c] placeholder-[#a3a3ac] outline-none focus:border-[#e5342b] focus:ring-2 focus:ring-[#fdeceb] transition";
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* input */}
        <div className="space-y-4">
          <Section icon={Sparkles} title="New video">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Topic or idea</label>
                <textarea
                  value={form.topic}
                  onChange={(e) => up("topic", e.target.value)}
                  rows={3}
                  placeholder="e.g. How AlphaFold3 changes drug discovery — explained for non-scientists"
                  className={field + " resize-none"}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Niche</label>
                  <input
                    value={form.niche}
                    onChange={(e) => up("niche", e.target.value)}
                    placeholder="AI in medicine"
                    className={field}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Tone</label>
                  <select value={form.tone} onChange={(e) => up("tone", e.target.value)} className={field}>
                    {TONES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Target audience</label>
                <input
                  value={form.audience}
                  onChange={(e) => up("audience", e.target.value)}
                  placeholder="Curious professionals, no biology background"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Focus keywords (optional)</label>
                <input
                  value={form.keywords}
                  onChange={(e) => up("keywords", e.target.value)}
                  placeholder="alphafold, protein folding, drug discovery"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Format</label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[#f4f4f2] p-1">
                  {[
                    { id: "long", label: "Long", icon: Film },
                    { id: "short", label: "Short", icon: Zap },
                    { id: "both", label: "Both", icon: LayoutGrid },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => up("format", o.id)}
                      className={
                        "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition " +
                        (form.format === o.id
                          ? "bg-white text-[#17171c] shadow-sm"
                          : "text-[#6b6b76] hover:text-[#17171c]")
                      }
                    >
                      <o.icon size={14} /> {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleGenerate()}
                disabled={gen.loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e5342b] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#c92a22] disabled:opacity-60"
              >
                {gen.loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {gen.loading ? "Generating…" : "Generate blueprint"}
              </button>
              {gen.error && <p className="text-sm text-[#c02a20]">{gen.error}</p>}
              {gen.loading && (
                <p className="flex items-center gap-2 text-xs text-[#6b6b76]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e5342b]" />
                  {gen.step}
                </p>
              )}
            </div>
          </Section>
        </div>

        {/* output */}
        <div>
          {currentVideo ? (
            renderBlueprint(currentVideo, (p) => updateVideo(currentVideo.id, p), gen.loading, gen.step)
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#e0dfd9] bg-white/60 p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fdeceb]">
                <Youtube size={22} className="text-[#e5342b]" />
              </div>
              <p className="sp-display text-lg font-semibold text-[#17171c]">Your blueprint lands here</p>
              <p className="mt-1 max-w-sm text-sm text-[#6b6b76]">
                Describe a video on the left. You'll get 5 A/B titles, a thumbnail concept, an SEO
                description, hooks, tags, and full short + long scripts — all editable and saved to
                your masterplan.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ------------------------------ Blueprint detail ------------------------------ */
  function renderBlueprint(v, onUpdate, loading, step) {
    return (
      <div className="space-y-5">
        {/* signature card */}
        <div className="overflow-hidden rounded-2xl border border-[#e7e6e1] bg-white">
          <div className="relative bg-gradient-to-br from-[#17171c] to-[#2a2340] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="sp-mono rounded-md bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/70">
                    Video blueprint
                  </span>
                  {v.tone && (
                    <span className="sp-mono text-[10px] text-white/50">{v.tone}</span>
                  )}
                </div>
                <TitleCarousel titles={v.titles} />
              </div>
            </div>
            {/* faux thumbnail preview */}
            <div className="mt-4 flex items-center gap-3">
              <div className="relative flex h-[72px] w-[128px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#e5342b] to-[#7a1f8f]">
                <span className="sp-display px-2 text-center text-[13px] font-extrabold uppercase leading-tight text-white drop-shadow">
                  {v.thumbnail ? v.thumbnail.overlays[0] : "…"}
                </span>
                <Play size={14} className="absolute bottom-1 right-1 text-white/80" fill="white" />
              </div>
              <div className="min-w-0 text-white/70">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Thumbnail direction</p>
                <p className="line-clamp-2 text-xs text-white/80">
                  {v.thumbnail ? v.thumbnail.visual : "Generating…"}
                </p>
              </div>
            </div>
          </div>

          {/* status + actions bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: STATUS_COLOR[v.status] }}
              />
              <select
                value={v.status}
                onChange={(e) => onUpdate({ status: e.target.value })}
                className="rounded-lg border border-[#e7e6e1] bg-white px-2 py-1 text-xs text-[#3a3a44] outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input
                type="date"
                value={v.scheduledDate}
                onChange={(e) => onUpdate({ scheduledDate: e.target.value })}
                className="rounded-lg border border-[#e7e6e1] bg-white px-2 py-1 text-xs text-[#3a3a44] outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <CopyBtn text={videoToMarkdown(v)} label="Copy all" small />
              <button
                onClick={() => download(v.topic.slice(0, 40).replace(/\W+/g, "-") + ".md", videoToMarkdown(v))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e6e1] bg-white px-2 py-1 text-xs text-[#3a3a44] hover:border-[#c9c8c2]"
              >
                <Download size={13} /> .md
              </button>
            </div>
          </div>
        </div>

        {/* titles A/B */}
        <Section icon={Type} title="Titles — A/B ready" right={v.titles && <Chip tone="indigo">{v.titles.length} variants</Chip>}>
          <div className="space-y-2">
            {v.titles ? (
              v.titles.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-[#f0efea] px-3 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eeecfb] sp-mono text-sm font-bold text-[#3a2fb5]">
                    {t.score}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#17171c]">{t.text}</p>
                    <p className="text-[11px] text-[#8b8b95]">{t.style} · {t.text.length} chars</p>
                  </div>
                  <CopyBtn text={t.text} small label="" />
                </div>
              ))
            ) : (
              <Skeleton rows={5} />
            )}
          </div>
        </Section>

        {/* thumbnail + hooks */}
        <div className="grid gap-5 md:grid-cols-2">
          <Section icon={ImageIcon} title="Thumbnail overlays">
            {v.thumbnail ? (
              <div className="space-y-2">
                {v.thumbnail.overlays.map((o, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[#f4f4f2] px-3 py-2">
                    <span className="sp-display text-sm font-bold uppercase text-[#17171c]">{o}</span>
                    <CopyBtn text={o} small label="" />
                  </div>
                ))}
                <p className="pt-1 text-xs text-[#6b6b76]">{v.thumbnail.visual}</p>
              </div>
            ) : (
              <Skeleton rows={3} />
            )}
          </Section>
          <Section icon={Zap} title="Opening hooks">
            {v.hooks ? (
              <ul className="space-y-2">
                {v.hooks.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg border border-[#f0efea] px-3 py-2 text-sm text-[#3a3a44]">
                    <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#e5342b]" />
                    <span className="flex-1">{h}</span>
                    <CopyBtn text={h} small label="" />
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton rows={3} />
            )}
          </Section>
        </div>

        {/* description */}
        <Section
          icon={FileText}
          title="Description (SEO)"
          right={v.description && <CopyBtn text={v.description} small />}
        >
          {v.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3a3a44]">{v.description}</p>
          ) : (
            <Skeleton rows={4} />
          )}
        </Section>

        {/* tags / hashtags / meta */}
        <div className="grid gap-5 md:grid-cols-2">
          <Section icon={Hash} title="Tags & hashtags" right={v.tags && <CopyBtn text={v.tags.join(", ")} small label="Tags" />}>
            {v.tags ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {v.tags.map((t, i) => (
                    <Chip key={i}>{t}</Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {v.hashtags.map((t, i) => (
                    <Chip key={i} tone="red">{t}</Chip>
                  ))}
                </div>
              </div>
            ) : (
              <Skeleton rows={2} />
            )}
          </Section>
          <Section icon={Target} title="Publish & engage">
            {v.cta ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#6b6b76]"><Clock size={12} /> Best window</p>
                  <p className="text-[#3a3a44]">{v.postingTime}</p>
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#6b6b76]"><TrendingUp size={12} /> CTAs</p>
                  {v.cta.map((c, i) => (
                    <p key={i} className="text-[#3a3a44]">• {c}</p>
                  ))}
                </div>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#6b6b76]"><MessageSquare size={12} /> Pinned comment</p>
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[#3a3a44]">{v.pinnedComment}</p>
                    <CopyBtn text={v.pinnedComment} small label="" />
                  </div>
                </div>
              </div>
            ) : (
              <Skeleton rows={4} />
            )}
          </Section>
        </div>

        {/* scripts */}
        {(v.format === "short" || v.format === "both") && (
          <Section
            icon={Zap}
            title="Short script"
            right={v.shortScript && <CopyBtn text={v.shortScript} small />}
          >
            {v.shortScript ? (
              <pre className="sp-mono whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3a3a44]">{v.shortScript}</pre>
            ) : loading ? (
              <ScriptLoading label="Writing the Short…" active={step && step.includes("Short")} />
            ) : (
              <Skeleton rows={4} />
            )}
          </Section>
        )}
        {(v.format === "long" || v.format === "both") && (
          <Section
            icon={Film}
            title="Long-form script"
            right={v.longScript && <CopyBtn text={v.longScript} small />}
          >
            {v.longScript ? (
              <pre className="sp-mono whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3a3a44]">{v.longScript}</pre>
            ) : loading ? (
              <ScriptLoading label="Writing the long-form cut…" active={step && step.includes("long")} />
            ) : (
              <Skeleton rows={6} />
            )}
          </Section>
        )}
      </div>
    );
  }

  /* ------------------------------ Masterplan view ------------------------------ */
  const [ideas, setIdeas] = useState({ loading: false, list: [], niche: "", count: 6, error: "" });

  async function runIdeas() {
    if (!ideas.niche.trim()) {
      setIdeas((s) => ({ ...s, error: "Enter your channel niche." }));
      return;
    }
    if (!hasKey) {
      setShowSettings(true);
      setIdeas((s) => ({ ...s, error: "Add your API key in Settings first." }));
      return;
    }
    setIdeas((s) => ({ ...s, loading: true, error: "", list: [] }));
    try {
      const list = await genIdeas(ask, ideas.niche, ideas.count);
      setIdeas((s) => ({ ...s, loading: false, list }));
    } catch (e) {
      setIdeas((s) => ({ ...s, loading: false, error: e.message }));
    }
  }

  function renderMasterplan() {
    return (
      <div className="space-y-5">
        <Section
          icon={Lightbulb}
          title="Idea engine"
          right={
            <div className="flex items-center gap-2">
              <select
                value={ideas.count}
                onChange={(e) => setIdeas((s) => ({ ...s, count: +e.target.value }))}
                className="rounded-lg border border-[#e7e6e1] bg-white px-2 py-1 text-xs"
              >
                {[4, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>{n} ideas</option>
                ))}
              </select>
            </div>
          }
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={ideas.niche}
              onChange={(e) => setIdeas((s) => ({ ...s, niche: e.target.value }))}
              placeholder="Your channel niche — e.g. AI for genomics & drug discovery"
              className="flex-1 rounded-xl border border-[#e7e6e1] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#e5342b] focus:ring-2 focus:ring-[#fdeceb]"
            />
            <button
              onClick={runIdeas}
              disabled={ideas.loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#17171c] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#000] disabled:opacity-60"
            >
              {ideas.loading ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
              Brainstorm
            </button>
          </div>
          {ideas.error && <p className="mt-2 text-sm text-[#c02a20]">{ideas.error}</p>}
          {ideas.list.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ideas.list.map((it, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-[#f0efea] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[#17171c]">{it.title}</p>
                    <Chip tone={it.format === "short" ? "red" : "indigo"}>{it.format}</Chip>
                  </div>
                  <p className="text-xs text-[#6b6b76]">{it.angle}</p>
                  <button
                    onClick={() => {
                      setTab("generate");
                      handleGenerate({ topic: it.title, niche: ideas.niche, format: it.format === "short" ? "short" : "both" });
                    }}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#fdeceb] px-2.5 py-1 text-xs font-medium text-[#c02a20] hover:bg-[#fbdedb]"
                  >
                    <Wand2 size={12} /> Blueprint this
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          icon={LayoutGrid}
          title="Content board"
          right={
            videos.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => download("masterplan.md", videos.map(videoToMarkdown).join("\n---\n\n"))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e6e1] bg-white px-2.5 py-1 text-xs text-[#3a3a44] hover:border-[#c9c8c2]"
                >
                  <Download size={13} /> Export all
                </button>
                <button
                  onClick={() => download("masterplan.json", JSON.stringify(videos, null, 2), "application/json")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e6e1] bg-white px-2.5 py-1 text-xs text-[#3a3a44] hover:border-[#c9c8c2]"
                >
                  <Download size={13} /> JSON
                </button>
              </div>
            )
          }
        >
          {videos.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#6b6b76]">No videos yet. Generate a blueprint or brainstorm ideas above.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <div key={v.id} className="group flex flex-col rounded-xl border border-[#f0efea] bg-white p-3 transition hover:border-[#e0dfd9] hover:shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className="sp-mono rounded-md px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: STATUS_COLOR[v.status] }}
                    >
                      {v.status}
                    </span>
                    <button
                      onClick={() => setVideos((vs) => vs.filter((x) => x.id !== v.id))}
                      className="text-[#c9c8c2] opacity-0 transition group-hover:opacity-100 hover:text-[#e5342b]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="line-clamp-2 flex-1 text-sm font-medium text-[#17171c]">
                    {v.titles ? v.titles[0].text : v.topic}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-[#8b8b95]">{v.niche || "—"}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex gap-1">
                      {(v.format === "short" || v.format === "both") && <Chip tone="red">short</Chip>}
                      {(v.format === "long" || v.format === "both") && <Chip tone="indigo">long</Chip>}
                    </div>
                    <button
                      onClick={() => setDrawerId(v.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#e5342b] hover:underline"
                    >
                      Open <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    );
  }

  /* ------------------------------ A/B lab view ------------------------------ */
  const [ab, setAb] = useState({ aLabel: "Variant A", bLabel: "Variant B", aImp: "", aClk: "", bImp: "", bClk: "" });
  const [thumb, setThumb] = useState({
    a: [false, false, false, false, false],
    b: [false, false, false, false, false],
  });
  const CRIT = [
    "One clear focal subject",
    "Readable text (≤4 words)",
    "High colour contrast",
    "Emotion / curiosity on face",
    "Reads at small size (mobile)",
  ];

  const abResult = useMemo(() => {
    const i1 = +ab.aImp, c1 = +ab.aClk, i2 = +ab.bImp, c2 = +ab.bClk;
    if (!(i1 > 0 && i2 > 0 && c1 >= 0 && c2 >= 0 && c1 <= i1 && c2 <= i2)) return null;
    const p1 = c1 / i1, p2 = c2 / i2;
    const pool = (c1 + c2) / (i1 + i2);
    const se = Math.sqrt(pool * (1 - pool) * (1 / i1 + 1 / i2));
    const z = se === 0 ? 0 : (p1 - p2) / se;
    const pval = 2 * (1 - normCdf(Math.abs(z)));
    const winner = p1 === p2 ? "Tie" : p1 > p2 ? "A" : "B";
    const lift = p1 === 0 || p2 === 0 ? null : ((Math.max(p1, p2) / Math.min(p1, p2) - 1) * 100);
    return { p1, p2, pval, winner, lift, sig: pval < 0.05, conf: (1 - pval) * 100 };
  }, [ab]);

  function renderAB() {
    const inp =
      "w-full rounded-lg border border-[#e7e6e1] bg-white px-3 py-2 text-sm outline-none focus:border-[#4234c7] focus:ring-2 focus:ring-[#eeecfb]";
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={Trophy} title="Title CTR test">
          <p className="mb-3 text-xs text-[#6b6b76]">
            Run two titles/thumbnails, then paste each variant's impressions and clicks from YouTube
            Studio. This runs a two-proportion z-test and calls a statistically sound winner.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {["a", "b"].map((k) => (
              <div key={k} className="rounded-xl border border-[#f0efea] p-3">
                <input
                  value={ab[k + "Label"]}
                  onChange={(e) => setAb((s) => ({ ...s, [k + "Label"]: e.target.value }))}
                  className="mb-2 w-full border-b border-[#f0efea] pb-1 text-sm font-semibold text-[#17171c] outline-none"
                />
                <label className="mb-1 block text-[11px] text-[#8b8b95]">Impressions</label>
                <input value={ab[k + "Imp"]} onChange={(e) => setAb((s) => ({ ...s, [k + "Imp"]: e.target.value.replace(/\D/g, "") }))} className={inp + " mb-2"} inputMode="numeric" placeholder="0" />
                <label className="mb-1 block text-[11px] text-[#8b8b95]">Clicks (views)</label>
                <input value={ab[k + "Clk"]} onChange={(e) => setAb((s) => ({ ...s, [k + "Clk"]: e.target.value.replace(/\D/g, "") }))} className={inp} inputMode="numeric" placeholder="0" />
              </div>
            ))}
          </div>

          {abResult ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[["a", ab.aLabel, abResult.p1], ["b", ab.bLabel, abResult.p2]].map(([k, label, p]) => (
                  <div
                    key={k}
                    className={
                      "rounded-xl border p-3 text-center " +
                      (abResult.winner.toLowerCase() === k && abResult.sig
                        ? "border-[#0d8a6a] bg-[#eafaf4]"
                        : "border-[#f0efea]")
                    }
                  >
                    <p className="text-[11px] text-[#8b8b95]">{label} CTR</p>
                    <p className="sp-display text-2xl font-bold text-[#17171c]">{(p * 100).toFixed(2)}%</p>
                  </div>
                ))}
              </div>
              <div
                className={
                  "rounded-xl p-3 text-sm " +
                  (abResult.sig ? "bg-[#eafaf4] text-[#0a6b52]" : "bg-[#fff7e8] text-[#8a5b00]")
                }
              >
                {abResult.winner === "Tie" ? (
                  <span>Identical CTR so far — keep testing.</span>
                ) : abResult.sig ? (
                  <span>
                    <strong>Variant {abResult.winner} wins</strong> at {abResult.conf.toFixed(1)}% confidence
                    {abResult.lift != null && <> (+{abResult.lift.toFixed(1)}% relative CTR)</>}. Ship it.
                  </span>
                ) : (
                  <span>
                    Variant {abResult.winner} leads, but at {abResult.conf.toFixed(1)}% confidence it's not
                    conclusive yet (need &lt;5% p-value). Gather more impressions.
                  </span>
                )}
              </div>
              <p className="sp-mono text-[11px] text-[#a3a3ac]">p-value = {abResult.pval.toFixed(4)}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#a3a3ac]">Enter impressions and clicks for both variants to see the winner.</p>
          )}
        </Section>

        <Section icon={ListChecks} title="Thumbnail scorecard">
          <p className="mb-3 text-xs text-[#6b6b76]">
            Score two thumbnail concepts against packaging fundamentals before you spend impressions
            on them.
          </p>
          <div className="overflow-hidden rounded-xl border border-[#f0efea]">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 bg-[#f4f4f2] px-3 py-2 text-[11px] font-medium text-[#6b6b76]">
              <span>Criterion</span>
              <span className="w-8 text-center">A</span>
              <span className="w-8 text-center">B</span>
            </div>
            {CRIT.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-[#f0efea] px-3 py-2 text-sm text-[#3a3a44]">
                <span>{c}</span>
                {["a", "b"].map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      setThumb((s) => {
                        const next = [...s[k]];
                        next[i] = !next[i];
                        return { ...s, [k]: next };
                      })
                    }
                    className={
                      "flex h-6 w-8 items-center justify-center rounded-md border transition " +
                      (thumb[k][i]
                        ? "border-[#0d8a6a] bg-[#0d8a6a] text-white"
                        : "border-[#e7e6e1] bg-white text-transparent hover:border-[#c9c8c2]")
                    }
                  >
                    <Check size={13} />
                  </button>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-[#f0efea] bg-[#fafaf9] px-3 py-2 text-sm font-semibold text-[#17171c]">
              <span>Score</span>
              <span className="w-8 text-center">{thumb.a.filter(Boolean).length}/5</span>
              <span className="w-8 text-center">{thumb.b.filter(Boolean).length}/5</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[#6b6b76]">
            {thumb.a.filter(Boolean).length === thumb.b.filter(Boolean).length
              ? "Even — decide with the CTR test on the left."
              : `Concept ${thumb.a.filter(Boolean).length > thumb.b.filter(Boolean).length ? "A" : "B"} is the stronger package to test first.`}
          </p>
        </Section>
      </div>
    );
  }

  /* ------------------------------ Toolkit view ------------------------------ */
  const [kit, setKit] = useState({ loading: false, niche: "", data: null, error: "" });
  async function runKit() {
    if (!kit.niche.trim()) {
      setKit((s) => ({ ...s, error: "Enter a niche." }));
      return;
    }
    if (!hasKey) {
      setShowSettings(true);
      setKit((s) => ({ ...s, error: "Add your API key in Settings first." }));
      return;
    }
    setKit((s) => ({ ...s, loading: true, error: "", data: null }));
    try {
      const data = await genToolkit(ask, kit.niche);
      setKit((s) => ({ ...s, loading: false, data }));
    } catch (e) {
      setKit((s) => ({ ...s, loading: false, error: e.message }));
    }
  }

  const DESC_TEMPLATE = `[HOOK — one line that restates the video's promise]

In this video:
[00:00] Intro
[00:00] Point one
[00:00] Point two

🔗 Resources & links:
- 

📌 Follow / connect:
- 

#hashtag #hashtag #hashtag`;

  const CTAS = [
    "If this changed how you think about it, subscribe — the next one goes deeper.",
    "Comment the one thing you'd want covered next; I read every reply.",
    "Full breakdown + links are in the description.",
    "Save this for later — you'll want it when you actually sit down to do it.",
    "Hit the bell so the follow-up doesn't get lost in your feed.",
  ];

  function renderToolkit() {
    return (
      <div className="space-y-5">
        <Section icon={Search} title="Keyword & hashtag engine">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={kit.niche}
              onChange={(e) => setKit((s) => ({ ...s, niche: e.target.value }))}
              placeholder="Niche — e.g. bioinformatics tutorials for clinicians"
              className="flex-1 rounded-xl border border-[#e7e6e1] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#e5342b] focus:ring-2 focus:ring-[#fdeceb]"
            />
            <button
              onClick={runKit}
              disabled={kit.loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#e5342b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c92a22] disabled:opacity-60"
            >
              {kit.loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Research
            </button>
          </div>
          {kit.error && <p className="mt-2 text-sm text-[#c02a20]">{kit.error}</p>}
          {kit.data && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 flex items-center justify-between text-xs font-medium text-[#6b6b76]">
                  SEO keywords <CopyBtn text={kit.data.seoKeywords.join(", ")} small label="" />
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {kit.data.seoKeywords.map((k, i) => <Chip key={i} tone="indigo">{k}</Chip>)}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center justify-between text-xs font-medium text-[#6b6b76]">
                  Hashtags <CopyBtn text={kit.data.hashtags.join(" ")} small label="" />
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {kit.data.hashtags.map((k, i) => <Chip key={i} tone="red">{k}</Chip>)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-[#6b6b76]">Adjacent videos to make</p>
                <ul className="space-y-1">
                  {kit.data.relatedSearches.map((r, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[#3a3a44]">
                      <Search size={12} className="text-[#a3a3ac]" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-[#6b6b76]">Content pillars</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {kit.data.contentPillars.map((p, i) => (
                    <div key={i} className="rounded-xl border border-[#f0efea] p-3">
                      <p className="text-sm font-semibold text-[#17171c]">{p.name}</p>
                      <p className="mt-0.5 text-xs text-[#6b6b76]">{p.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Section>

        <div className="grid gap-5 md:grid-cols-2">
          <Section icon={PenLine} title="Description template" right={<CopyBtn text={DESC_TEMPLATE} small />}>
            <pre className="sp-mono whitespace-pre-wrap rounded-lg bg-[#f4f4f2] p-3 text-[12px] leading-relaxed text-[#3a3a44]">{DESC_TEMPLATE}</pre>
          </Section>
          <Section icon={MessageSquare} title="CTA library">
            <ul className="space-y-2">
              {CTAS.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-[#f0efea] px-3 py-2 text-sm text-[#3a3a44]">
                  <span className="flex-1">{c}</span>
                  <CopyBtn text={c} small label="" />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <Section icon={Clock} title="Publishing cadence — quick reference">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0efea] text-left text-xs text-[#6b6b76]">
                  <th className="py-2 pr-4 font-medium">Format</th>
                  <th className="py-2 pr-4 font-medium">Sustainable cadence</th>
                  <th className="py-2 font-medium">Why it works</th>
                </tr>
              </thead>
              <tbody className="text-[#3a3a44]">
                {[
                  ["Long-form", "1–2 / week", "Enough watch-time signal without burning out; each video gets a fair test window."],
                  ["Shorts", "3–7 / week", "Feed-driven reach rewards volume; batch-film to protect long-form quality."],
                  ["Community posts", "2–3 / week", "Keeps the channel warm between uploads and feeds the algorithm engagement."],
                ].map((r, i) => (
                  <tr key={i} className="border-b border-[#f7f6f2]">
                    <td className="py-2.5 pr-4 font-medium">{r[0]}</td>
                    <td className="py-2.5 pr-4">{r[1]}</td>
                    <td className="py-2.5 text-[#6b6b76]">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[#a3a3ac]">
            Consistency beats frequency — pick a cadence you can hold for 90 days, then use the A/B Lab
            to compound what's working.
          </p>
        </Section>
      </div>
    );
  }

  /* ------------------------------ Settings ------------------------------ */
  function renderSettings() {
    const p = PROVIDERS[settings.provider];
    const setProvider = (id) =>
      setSettings((s) => ({
        ...s,
        provider: id,
        model: PROVIDERS[id].models[0] || "",
        endpoint: PROVIDERS[id].editableEndpoint ? s.endpoint : "",
      }));
    const inp =
      "w-full rounded-xl border border-[#e7e6e1] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#e5342b] focus:ring-2 focus:ring-[#fdeceb]";
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={() => setShowSettings(false)} />
        <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound size={16} className="text-[#e5342b]" />
              <h2 className="sp-display text-lg font-bold">Model &amp; API keys</h2>
            </div>
            <button onClick={() => setShowSettings(false)} className="rounded-lg p-1.5 text-[#6b6b76] hover:bg-[#f4f4f2]">
              <X size={18} />
            </button>
          </div>

          <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Provider</label>
          <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {Object.entries(PROVIDERS).map(([id, pr]) => (
              <button
                key={id}
                onClick={() => setProvider(id)}
                className={
                  "rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition " +
                  (settings.provider === id
                    ? "border-[#e5342b] bg-[#fdeceb] text-[#c02a20]"
                    : "border-[#e7e6e1] text-[#3a3a44] hover:border-[#c9c8c2]")
                }
              >
                {pr.label}
              </button>
            ))}
          </div>

          {p.editableEndpoint && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-[#6b6b76]">API endpoint</label>
              <input
                value={settings.endpoint}
                onChange={(e) => setSettings((s) => ({ ...s, endpoint: e.target.value }))}
                placeholder="https://…/v1/chat/completions"
                className={inp}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-[#6b6b76]">Model</label>
            <input
              value={settings.model}
              onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
              placeholder="model id"
              className={inp}
            />
            {p.models.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.models.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSettings((s) => ({ ...s, model: m }))}
                    className={
                      "sp-mono rounded-md border px-2 py-0.5 text-[11px] " +
                      (settings.model === m
                        ? "border-[#3a2fb5] bg-[#eeecfb] text-[#3a2fb5]"
                        : "border-[#e7e6e1] text-[#6b6b76] hover:border-[#c9c8c2]")
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-[#6b6b76]">
              <span>API key</span>
              {p.keyUrl && (
                <a href={p.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#e5342b] hover:underline">
                  Get a key <ExternalLink size={11} />
                </a>
              )}
            </label>
            <input
              type="password"
              value={settings.keys[settings.provider] || ""}
              onChange={(e) => setSettings((s) => ({ ...s, keys: { ...s.keys, [s.provider]: e.target.value } }))}
              placeholder={p.keyHint}
              className={inp}
            />
          </div>

          {p.note && (
            <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-[#fff7e8] px-3 py-2 text-xs text-[#8a5b00]">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {p.note}
            </p>
          )}

          <p className="text-[11px] leading-relaxed text-[#8b8b95]">
            Requests go straight from your browser to the provider. Keys are stored only in this
            browser (localStorage) and never touch any StudioPlan server. If a provider blocks browser
            calls (CORS), switch to OpenRouter — one key reaches Claude, GPT, Grok and more.
          </p>

          <button
            onClick={() => setShowSettings(false)}
            className="mt-4 w-full rounded-xl bg-[#17171c] py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ Shell ------------------------------ */
  return (
    <div className="sp-root min-h-screen bg-[#f6f5f2] text-[#17171c]">
      <div className="mx-auto flex min-h-screen max-w-[1240px]">
        {/* sidebar */}
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[#e7e6e1] bg-white px-3 py-5 md:flex">
          <div className="mb-7 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e5342b]">
              <Play size={16} className="text-white" fill="white" />
            </div>
            <div className="leading-none">
              <p className="sp-display text-[15px] font-extrabold">StudioPlan</p>
              <p className="text-[10px] text-[#8b8b95]">YouTube masterplan</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                  (tab === n.id
                    ? "bg-[#fdeceb] text-[#c02a20]"
                    : "text-[#6b6b76] hover:bg-[#f4f4f2] hover:text-[#17171c]")
                }
              >
                <n.icon size={17} /> {n.label}
                {n.id === "masterplan" && videos.length > 0 && (
                  <span className="ml-auto rounded-full bg-[#17171c] px-1.5 py-0.5 text-[10px] text-white">{videos.length}</span>
                )}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setShowSettings(true)}
            className="mt-auto flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-[#6b6b76] transition hover:bg-[#f4f4f2] hover:text-[#17171c]"
          >
            <SettingsIcon size={17} /> Settings
            <span className={"ml-auto h-2 w-2 rounded-full " + (hasKey ? "bg-[#0d8a6a]" : "bg-[#e5342b]")} />
          </button>
          <div className="mt-2 rounded-xl bg-[#f4f4f2] p-3">
            <p className="text-[11px] leading-relaxed text-[#8b8b95]">
              Bring your own key — {hasKey ? PROVIDERS[settings.provider].label : "no key set yet"}. Keys
              and your masterplan are saved only in this browser.
            </p>
          </div>
        </aside>

        {/* main */}
        <main className="min-w-0 flex-1">
          {/* mobile nav */}
          <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-[#e7e6e1] bg-white/90 px-3 py-2 backdrop-blur md:hidden">
            <div className="mr-2 flex items-center gap-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#e5342b]">
                <Play size={12} className="text-white" fill="white" />
              </div>
              <span className="sp-display text-sm font-extrabold">StudioPlan</span>
            </div>
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium " +
                  (tab === n.id ? "bg-[#fdeceb] text-[#c02a20]" : "text-[#6b6b76]")
                }
              >
                <n.icon size={14} /> {n.label}
              </button>
            ))}
            <button
              onClick={() => setShowSettings(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#6b6b76]"
            >
              <SettingsIcon size={14} /> Keys
              <span className={"h-1.5 w-1.5 rounded-full " + (hasKey ? "bg-[#0d8a6a]" : "bg-[#e5342b]")} />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-5 hidden items-end justify-between md:flex">
              <div>
                <h1 className="sp-display text-2xl font-extrabold tracking-tight">
                  {tab === "generate" && "Generate"}
                  {tab === "masterplan" && "Masterplan"}
                  {tab === "abtest" && "A/B Lab"}
                  {tab === "toolkit" && "Toolkit"}
                </h1>
                <p className="text-sm text-[#6b6b76]">
                  {tab === "generate" && "Turn one idea into a full, packaged video — titles, thumbnail, description, hooks, and scripts."}
                  {tab === "masterplan" && "Brainstorm a slate of ideas and manage every video through to publish."}
                  {tab === "abtest" && "Decide titles and thumbnails with data, not vibes."}
                  {tab === "toolkit" && "SEO research, templates, and cadence — the reusable marketing layer."}
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 rounded-xl border border-[#e7e6e1] bg-white px-3 py-2 text-xs text-[#3a3a44] transition hover:border-[#c9c8c2]"
              >
                <span className={"h-2 w-2 rounded-full " + (hasKey ? "bg-[#0d8a6a]" : "bg-[#e5342b]")} />
                <span className="sp-mono">{hasKey ? settings.model : "Set API key"}</span>
                <SettingsIcon size={13} />
              </button>
            </div>

            {tab === "generate" && renderGenerate()}
            {tab === "masterplan" && renderMasterplan()}
            {tab === "abtest" && renderAB()}
            {tab === "toolkit" && renderToolkit()}
          </div>
        </main>
      </div>

      {/* drawer */}
      {drawerVideo && (
        <div className="fixed inset-0 z-30 flex">
          <div className="flex-1 bg-black/30" onClick={() => setDrawerId(null)} />
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-[#f6f5f2] p-4 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="sp-display text-lg font-bold">Blueprint</p>
              <button onClick={() => setDrawerId(null)} className="rounded-lg p-1.5 text-[#6b6b76] hover:bg-white">
                <X size={18} />
              </button>
            </div>
            {renderBlueprint(drawerVideo, (p) => updateVideo(drawerVideo.id, p), false, "")}
          </div>
        </div>
      )}

      {showSettings && renderSettings()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TitleCarousel({ titles }) {
  const [i, setI] = useState(0);
  if (!titles) return <div className="h-6 w-3/4 animate-pulse rounded bg-white/10" />;
  const t = titles[i % titles.length];
  return (
    <div>
      <h2 className="sp-display text-lg font-extrabold leading-snug text-white sm:text-xl">{t.text}</h2>
      <div className="mt-2 flex items-center gap-2">
        <span className="sp-mono text-[10px] text-white/50">{t.style} · {t.score}/10</span>
        <div className="flex gap-1">
          {titles.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              className={"h-1.5 rounded-full transition-all " + (k === i % titles.length ? "w-4 bg-white" : "w-1.5 bg-white/30")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-[#f0efea]" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
      ))}
    </div>
  );
}

function ScriptLoading({ label, active }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-[#6b6b76]">
      <Loader2 size={15} className={"text-[#e5342b] " + (active ? "animate-spin" : "")} />
      {active ? label : "Queued…"}
    </div>
  );
}
