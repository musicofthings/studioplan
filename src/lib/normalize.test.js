import { describe, it, expect } from "vitest";
import { normalizeBlueprint, normalizeIdeas, normalizeToolkit } from "./normalize";

describe("normalizeBlueprint", () => {
  it("fills defaults for missing fields", () => {
    const n = normalizeBlueprint(null);
    expect(n.titles).toEqual([]);
    expect(n.thumbnail.overlays).toEqual([]);
    expect(n.hooks).toEqual([]);
    expect(n.tags).toEqual([]);
  });

  it("filters empty titles and clamps scores", () => {
    const n = normalizeBlueprint({
      titles: [
        { style: "X", text: "Hello", score: 99 },
        { style: "Y", text: "", score: 3 },
      ],
      thumbnail: { overlays: ["A", "", 12], visual: "dir" },
    });
    expect(n.titles).toHaveLength(1);
    expect(n.titles[0].score).toBe(10);
    expect(n.thumbnail.overlays).toEqual(["A", "12"]);
  });
});

describe("normalizeIdeas", () => {
  it("maps format and drops empty titles", () => {
    const list = normalizeIdeas([
      { title: "One", angle: "a", format: "SHORT" },
      { title: "", angle: "b", format: "long" },
      { title: "Two", angle: "c" },
    ]);
    expect(list).toEqual([
      { title: "One", angle: "a", format: "short" },
      { title: "Two", angle: "c", format: "long" },
    ]);
  });
});

describe("normalizeToolkit", () => {
  it("returns empty arrays when shape is wrong", () => {
    const t = normalizeToolkit({ seoKeywords: "nope" });
    expect(t.seoKeywords).toEqual([]);
    expect(t.hashtags).toEqual([]);
  });
});
