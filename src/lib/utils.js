export function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta);
  return Promise.resolve();
}

export function download(name, text, type = "text/markdown") {
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

export function videoToMarkdown(v) {
  let m = `# ${v.topic}\n\n`;
  m += `**Niche:** ${v.niche || "—"}  |  **Tone:** ${v.tone}  |  **Status:** ${v.status}\n\n`;
  if (v.titles?.length) {
    m += `## Title options (A/B)\n`;
    v.titles.forEach((t) => (m += `- **[${t.style} · ${t.score}/10]** ${t.text}\n`));
    m += `\n`;
  }
  if (v.thumbnail) {
    const overlays = (v.thumbnail.overlays || []).join(" / ") || "—";
    m += `## Thumbnail\n- Overlay text: ${overlays}\n- Direction: ${v.thumbnail.visual || "—"}\n\n`;
  }
  if (v.hooks?.length) m += `## Hooks\n${v.hooks.map((h) => `- ${h}`).join("\n")}\n\n`;
  if (v.description) m += `## Description\n${v.description}\n\n`;
  if (v.tags?.length) m += `## Tags\n${v.tags.join(", ")}\n\n`;
  if (v.hashtags?.length) m += `## Hashtags\n${v.hashtags.join(" ")}\n\n`;
  if (v.cta?.length) m += `## CTAs\n${v.cta.map((c) => `- ${c}`).join("\n")}\n\n`;
  if (v.postingTime) m += `## Publish window\n${v.postingTime}\n\n`;
  if (v.pinnedComment) m += `## Pinned comment\n${v.pinnedComment}\n\n`;
  if (v.shortScript) m += `## Short script\n${v.shortScript}\n\n`;
  if (v.longScript) m += `## Long-form script\n${v.longScript}\n\n`;
  return m;
}

export function slugifyFilename(topic) {
  return (topic || "blueprint").slice(0, 40).replace(/\W+/g, "-") || "blueprint";
}
