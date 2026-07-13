/** Abramowitz & Stegun erf approximation (good enough for UI stats). */
export function erf(x) {
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

export const normCdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

/**
 * Two-proportion z-test for CTR (clicks / impressions).
 * Does NOT report "confidence = 1 - p" — that is statistically incorrect.
 *
 * @returns {null|object} result or null if inputs are invalid
 */
export function twoProportionZTest({ aImp, aClk, bImp, bClk, alpha = 0.05, minImpressions = 1000 }) {
  const i1 = +aImp;
  const c1 = +aClk;
  const i2 = +bImp;
  const c2 = +bClk;
  if (!(i1 > 0 && i2 > 0 && c1 >= 0 && c2 >= 0 && c1 <= i1 && c2 <= i2)) return null;

  const p1 = c1 / i1;
  const p2 = c2 / i2;
  const pool = (c1 + c2) / (i1 + i2);
  const se = Math.sqrt(pool * (1 - pool) * (1 / i1 + 1 / i2));
  const z = se === 0 ? 0 : (p1 - p2) / se;
  const pval = 2 * (1 - normCdf(Math.abs(z)));
  const winner = p1 === p2 ? "Tie" : p1 > p2 ? "A" : "B";
  const lift =
    p1 === 0 || p2 === 0 ? null : (Math.max(p1, p2) / Math.min(p1, p2) - 1) * 100;
  const sig = pval < alpha;

  // Expected counts under H0 for a rough normal-approx check
  const e1c = pool * i1;
  const e1n = (1 - pool) * i1;
  const e2c = pool * i2;
  const e2n = (1 - pool) * i2;
  const lowExpected = Math.min(e1c, e1n, e2c, e2n) < 5;
  const lowSample = i1 + i2 < minImpressions || lowExpected;

  return {
    p1,
    p2,
    pval,
    z,
    winner,
    lift,
    sig,
    alpha,
    lowSample,
    totalImpressions: i1 + i2,
  };
}
