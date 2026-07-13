import { describe, it, expect } from "vitest";
import { erf, normCdf, twoProportionZTest } from "./stats";

describe("erf / normCdf", () => {
  it("erf(0) ≈ 0", () => {
    expect(Math.abs(erf(0))).toBeLessThan(1e-6);
  });

  it("normCdf(0) ≈ 0.5", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 4);
  });

  it("normCdf is roughly 1 for large positive z", () => {
    expect(normCdf(5)).toBeGreaterThan(0.999);
  });
});

describe("twoProportionZTest", () => {
  it("returns null for invalid inputs", () => {
    expect(twoProportionZTest({ aImp: 0, aClk: 0, bImp: 100, bClk: 10 })).toBeNull();
    expect(twoProportionZTest({ aImp: 100, aClk: 120, bImp: 100, bClk: 10 })).toBeNull();
  });

  it("detects a clear winner as significant", () => {
    // A: 200/10000 = 2%, B: 100/10000 = 1% — large n, should be sig
    const r = twoProportionZTest({
      aImp: 10000,
      aClk: 200,
      bImp: 10000,
      bClk: 100,
    });
    expect(r).not.toBeNull();
    expect(r.winner).toBe("A");
    expect(r.sig).toBe(true);
    expect(r.pval).toBeLessThan(0.05);
    // Must NOT expose 1-p as "confidence"
    expect(r).not.toHaveProperty("conf");
  });

  it("does not call significance on a tiny difference with small n", () => {
    const r = twoProportionZTest({
      aImp: 100,
      aClk: 5,
      bImp: 100,
      bClk: 4,
    });
    expect(r).not.toBeNull();
    expect(r.lowSample).toBe(true);
    expect(r.sig).toBe(false);
  });

  it("flags low sample under the impression threshold", () => {
    const r = twoProportionZTest({
      aImp: 200,
      aClk: 20,
      bImp: 200,
      bClk: 10,
      minImpressions: 1000,
    });
    expect(r.lowSample).toBe(true);
  });

  it("reports tie when CTRs are equal", () => {
    const r = twoProportionZTest({
      aImp: 5000,
      aClk: 100,
      bImp: 5000,
      bClk: 100,
    });
    expect(r.winner).toBe("Tie");
    expect(r.sig).toBe(false);
  });
});
