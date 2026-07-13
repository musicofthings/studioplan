/** Strip markdown fences and parse the first JSON object/array in text. */
export function parseJSON(text) {
  let t = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const a = t.indexOf("[");
    const start = s === -1 ? a : a === -1 ? s : Math.min(s, a);
    const endObj = t.lastIndexOf("}");
    const endArr = t.lastIndexOf("]");
    const end = Math.max(endObj, endArr);
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(t.slice(start, end + 1));
    }
    throw new Error("Could not read a valid result.");
  }
}
