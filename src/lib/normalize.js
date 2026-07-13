function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function asString(v, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalize a packaging blueprint from the LLM into a safe shape for UI. */
export function normalizeBlueprint(raw) {
  const bp = raw && typeof raw === "object" ? raw : {};
  const titles = asArray(bp.titles)
    .map((t) => ({
      style: asString(t?.style, "Variant"),
      text: asString(t?.text),
      score: Math.min(10, Math.max(0, asNumber(t?.score, 5))),
    }))
    .filter((t) => t.text);

  const overlays = asArray(bp.thumbnail?.overlays)
    .map((o) => asString(o).trim())
    .filter(Boolean);

  return {
    titles,
    description: asString(bp.description),
    tags: asArray(bp.tags).map((t) => asString(t)).filter(Boolean),
    hashtags: asArray(bp.hashtags).map((t) => asString(t)).filter(Boolean),
    thumbnail: {
      overlays,
      visual: asString(bp.thumbnail?.visual),
    },
    hooks: asArray(bp.hooks).map((h) => asString(h)).filter(Boolean),
    cta: asArray(bp.cta).map((c) => asString(c)).filter(Boolean),
    postingTime: asString(bp.postingTime),
    pinnedComment: asString(bp.pinnedComment),
    chapters: asArray(bp.chapters)
      .map((c) => ({
        time: asString(c?.time, "0:00"),
        title: asString(c?.title, "Chapter"),
      }))
      .filter((c) => c.title),
  };
}

/** Normalize idea-engine list. */
export function normalizeIdeas(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((it) => ({
      title: asString(it?.title),
      angle: asString(it?.angle),
      format: asString(it?.format, "long").toLowerCase() === "short" ? "short" : "long",
    }))
    .filter((it) => it.title);
}

/** Normalize toolkit research payload. */
export function normalizeToolkit(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  return {
    hashtags: asArray(d.hashtags).map((t) => asString(t)).filter(Boolean),
    seoKeywords: asArray(d.seoKeywords).map((t) => asString(t)).filter(Boolean),
    relatedSearches: asArray(d.relatedSearches).map((t) => asString(t)).filter(Boolean),
    contentPillars: asArray(d.contentPillars)
      .map((p) => ({
        name: asString(p?.name),
        description: asString(p?.description),
      }))
      .filter((p) => p.name),
  };
}
