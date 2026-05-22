/**
 * Statistical functions for evaluation metrics.
 * Pure functions, no external dependencies.
 */

/**
 * Complementary error function (erfc) via Horner approximation.
 * Abramowitz & Stegun formula 7.1.26, max error ~1.5e-7.
 * Used for chi-squared p-value with 1 df: p = erfc(sqrt(chi2/2)).
 */
export function erfc(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);
  return 1.0 - sign * y;
}

/**
 * Bootstrap confidence intervals.
 * Returns [point estimate, lower bound, upper bound].
 */
export function bootstrapCI(
  values: boolean[],
  metric: (vals: boolean[]) => number,
  iterations: number = 10000,
  confidence: number = 0.95,
): [number, number, number] {
  const n = values.length;

  if (n < 30) {
    const point = metric(values);
    const successes = values.filter((v) => v).length;
    const p = successes / n;
    const se = Math.sqrt((p * (1 - p)) / n);
    const tCrit = 2.045;
    const margin = tCrit * se;
    return [point, Math.max(0, point - margin), Math.min(100, point + margin)];
  }

  const allSame = values.every((v) => v === values[0]);
  if (allSame) {
    const point = metric(values);
    return [point, point, point];
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const resample: boolean[] = [];
    for (let j = 0; j < n; j++) {
      resample.push(values[Math.floor(Math.random() * n)]);
    }
    samples.push(metric(resample));
  }

  samples.sort((a, b) => a - b);
  const alpha = 1 - confidence;
  const lowerIdx = Math.floor(iterations * (alpha / 2));
  const upperIdx = Math.floor(iterations * (1 - alpha / 2));
  const point = metric(values);

  return [point, samples[lowerIdx], samples[upperIdx]];
}

/**
 * McNemar's test for paired binary classification.
 * Tests whether two classifiers have significantly different error rates.
 */
export function mcnemarTest(
  baselineCorrect: boolean[],
  improvedCorrect: boolean[],
): { statistic: number; pValue: number; significant: boolean } {
  if (baselineCorrect.length !== improvedCorrect.length) {
    throw new Error("McNemar test requires arrays of equal length");
  }

  let b01 = 0; // Baseline wrong, improved correct
  let b10 = 0; // Baseline correct, improved wrong

  for (let i = 0; i < baselineCorrect.length; i++) {
    const b = baselineCorrect[i];
    const imp = improvedCorrect[i];
    if (!b && imp) b01++;
    else if (b && !imp) b10++;
  }

  const discordant = b01 + b10;

  if (discordant === 0) {
    return { statistic: 0, pValue: 1.0, significant: false };
  }

  // Exact binomial test for small samples
  if (discordant < 25) {
    const n = discordant;
    const k = Math.max(b01, b10);
    let pValue = 0;

    for (let x = k; x <= n; x++) {
      let logCoeff = 0;
      for (let i = 0; i < x; i++) {
        logCoeff += Math.log(n - i) - Math.log(i + 1);
      }
      pValue += Math.exp(logCoeff - n * Math.log(2));
    }
    pValue = Math.min(1.0, pValue * 2);

    return { statistic: 0, pValue, significant: pValue < 0.05 };
  }

  // Chi-squared approximation with continuity correction
  const chi2 = Math.pow(Math.abs(b01 - b10) - 1, 2) / discordant;
  const pValue = erfc(Math.sqrt(chi2 / 2));

  return { statistic: chi2, pValue, significant: pValue < 0.05 };
}

/** Cohen's h for effect size between two proportions (as percentages). */
export function cohensH(p1: number, p2: number): number {
  const h1 = 2 * Math.asin(Math.sqrt(p1 / 100));
  const h2 = 2 * Math.asin(Math.sqrt(p2 / 100));
  return h1 - h2;
}

/**
 * Discounted Cumulative Gain at position p.
 * DCG_p = sum(rel_i / log2(i + 1)) for i from 1 to p
 */
export function dcg(relevance: number[], p: number = Infinity): number {
  const limit = Math.min(p, relevance.length);
  return relevance
    .slice(0, limit)
    .reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);
}

/**
 * Normalized Discounted Cumulative Gain at position p.
 * NDCG_p = DCG_p / IDCG_p
 */
export function ndcg(
  actualRelevance: number[],
  p: number = Infinity,
): number {
  if (actualRelevance.length === 0) return 0;

  const idealRelevance = [...actualRelevance].sort((a, b) => b - a);
  const dcgActual = dcg(actualRelevance, p);
  const idcg = dcg(idealRelevance, p);

  if (idcg === 0) return 0;
  return dcgActual / idcg;
}
