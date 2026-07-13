import { describe, it, expect } from "vitest";
import { parseJSON } from "./parseJSON";

describe("parseJSON", () => {
  it("parses plain JSON object", () => {
    expect(parseJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses plain JSON array", () => {
    expect(parseJSON("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("strips markdown fences", () => {
    expect(parseJSON('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it("extracts object from surrounding prose", () => {
    expect(parseJSON('Here you go:\n{"x":"y"}\nThanks!')).toEqual({ x: "y" });
  });

  it("throws on garbage", () => {
    expect(() => parseJSON("no json here")).toThrow(/valid result/i);
  });
});
