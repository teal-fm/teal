/**
 * Evaluation reporting and failure-mode analysis.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  type EvaluationCase,
  type SearchConfig,
  type APIMetrics,
  formatTime,
} from "./types.js";
import {
  bootstrapCI,
  mcnemarTest,
  cohensH,
} from "./statistics.js";

// ── Failure-mode classification ────────────────────────────────────────

export function categorizeFailureMode(track: string, artist: string): string {
  if (
    /\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i.test(track) ||
    /\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/i.test(artist) ||
    /\(feat\.|\(ft\.|\(featuring/i.test(track)
  ) {
    return "featuring";
  }
  if (/\bremix\b|\brmx\b|\bre-?mix/i.test(track) || /\(remix\)|\[remix\]/i.test(track)) {
    return "remix";
  }
  if (/\blive\b/i.test(track) || /\(live\)|\[live\]/i.test(track)) {
    return "live";
  }
  if (/\([^)]+\)|\[[^\]]+\]/.test(track)) {
    return "parenthetical";
  }
  if (/[^\w\s\-'&]/.test(track) || /[^\w\s\-'&]/.test(artist)) {
    return "special_chars";
  }
  if (track.length < 5 || artist.length < 5) {
    return "short_name";
  }
  return "standard";
}

const AMBIGUOUS_WORDS = new Set([
  "air","one","two","three","four","five","six","seven","eight","nine","ten",
  "song","track","music","beat","sound","tune","piece","high","low","new","old",
  "love","time","life","day","night","sun","moon","star","sky","sea","water",
  "fire","wind","earth","light","dark","red","blue","green","black","white",
  "big","small","good","bad","yes","no","ok","okay","hi","hey","hello","bye",
  "go","come","get","take","give","make","do","be","see","know","think","say",
  "want","need","like","can","will","may","must","should","could","would",
]);

export function classifyHardness(
  track: string,
  artist: string,
  _failureMode: string,
  baselinePos: number,
  baselineFound: boolean,
): "easy" | "medium" | "hard" {
  const trackLower = track.toLowerCase().trim();
  const trackWords = trackLower.split(/\s+/).filter((w) => w.length > 0);

  if (baselineFound && baselinePos >= 0 && baselinePos < 5) return "easy";
  if (baselineFound && baselinePos >= 5 && baselinePos < 25) return "medium";

  if (!baselineFound) {
    if (artist.length < 3 || track.length < 3) return "hard";
    if (track.length < 4) return "hard";
    if (/^\d+$/.test(track.trim())) return "hard";
    if (trackWords.length === 1 && AMBIGUOUS_WORDS.has(trackWords[0])) return "hard";

    if (artist && artist.length >= 3 && track.length >= 4) {
      if (trackWords.length > 1) return "medium";
      if (trackWords.length === 1 && !AMBIGUOUS_WORDS.has(trackWords[0])) return "medium";
    }

    if (!artist || artist.trim().length === 0) {
      if (track.length < 6 || (trackWords.length === 1 && AMBIGUOUS_WORDS.has(trackWords[0]))) return "hard";
      if (trackWords.length > 1 && track.length >= 6) return "medium";
      if (trackWords.length === 1 && !AMBIGUOUS_WORDS.has(trackWords[0]) && track.length >= 6) return "medium";
      return "hard";
    }

    return "hard";
  }

  return "medium";
}

// ── EvaluationOutput bag ───────────────────────────────────────────────

export interface EvaluationOutput {
  cases: EvaluationCase[];
  scrobblesTotal: number;
  validScrobblesCount: number;
  duplicateStats: {
    total: number;
    unique: number;
    duplicates: number;
    maxDuplicates: number;
  };
  duplicateDistribution: Record<number, number>;
  searchConfig: SearchConfig;
  apiMetrics: APIMetrics;
  startTime: number;
  evaluationStartTime: number;
  baselineCacheHits: number;
  improvedCacheHits: number;
  evaluationResultCacheHits: number;
  totalSearches: number;
}

// ── Main reporting function ────────────────────────────────────────────

export function reportResults(output: EvaluationOutput): void {
  const {
    cases,
    scrobblesTotal,
    validScrobblesCount,
    duplicateStats,
    duplicateDistribution,
    searchConfig,
    apiMetrics,
    startTime,
    baselineCacheHits,
    improvedCacheHits,
    evaluationResultCacheHits,
    totalSearches,
  } = output;

  // Calculate all metrics from cases
  let baselineP1 = 0, baselineP5 = 0, baselineP10 = 0, baselineP25 = 0, baselineFound = 0;
  let improvedP1 = 0, improvedP5 = 0, improvedP10 = 0, improvedP25 = 0, improvedFound = 0;
  let baselineBetter = 0, improvedBetter = 0, bothSame = 0;
  let baselineMRR = 0, improvedMRR = 0;
  let baselineNDCGSum = 0, improvedNDCGSum = 0;
  const baselinePositions: number[] = [];
  const improvedPositions: number[] = [];
  const trackLengths: number[] = [];
  const artistLengths: number[] = [];
  const positionByFieldCombo: Record<string, { baseline: number[]; improved: number[] }> = {};

  for (const c of cases) {
    const combo = c.fieldCombination || "track+artist";
    if (!positionByFieldCombo[combo]) positionByFieldCombo[combo] = { baseline: [], improved: [] };
    positionByFieldCombo[combo].baseline.push(c.baselinePos);
    positionByFieldCombo[combo].improved.push(c.improvedPos);

    if (c.baselinePos === 0) baselineP1++;
    if (c.baselinePos >= 0 && c.baselinePos < 5) baselineP5++;
    if (c.baselinePos >= 0 && c.baselinePos < 10) baselineP10++;
    if (c.baselinePos >= 0 && c.baselinePos < 25) baselineP25++;
    if (c.baselineFound) baselineFound++;

    if (c.improvedPos === 0) improvedP1++;
    if (c.improvedPos >= 0 && c.improvedPos < 5) improvedP5++;
    if (c.improvedPos >= 0 && c.improvedPos < 10) improvedP10++;
    if (c.improvedPos >= 0 && c.improvedPos < 25) improvedP25++;
    if (c.improvedFound) improvedFound++;

    baselineMRR += c.baselineFound ? 1 / (c.baselinePos + 1) : 0;
    improvedMRR += c.improvedFound ? 1 / (c.improvedPos + 1) : 0;
    baselineNDCGSum += c.baselineNDCG;
    improvedNDCGSum += c.improvedNDCG;
    baselinePositions.push(c.baselineFound ? c.baselinePos : -1);
    improvedPositions.push(c.improvedFound ? c.improvedPos : -1);
    trackLengths.push(c.track.length);
    artistLengths.push(c.artist.length);

    if (c.baselineFound && !c.improvedFound) baselineBetter++;
    else if (c.improvedFound && !c.baselineFound) improvedBetter++;
    else if (c.baselineFound && c.improvedFound) {
      if (c.baselinePos < c.improvedPos) baselineBetter++;
      else if (c.improvedPos < c.baselinePos) improvedBetter++;
      else bothSame++;
    } else bothSame++;
  }

  baselineMRR /= cases.length;
  improvedMRR /= cases.length;
  const baselineNDCG = baselineNDCGSum / cases.length;
  const improvedNDCG = improvedNDCGSum / cases.length;

  // Boolean arrays for statistical tests
  const pctMetric = (vals: boolean[]) => (vals.filter((v) => v).length / vals.length) * 100;
  const baselineP1Arr = cases.map((c) => c.baselinePos === 0);
  const baselineP5Arr = cases.map((c) => c.baselinePos >= 0 && c.baselinePos < 5);
  const baselineP10Arr = cases.map((c) => c.baselinePos >= 0 && c.baselinePos < 10);
  const baselineP25Arr = cases.map((c) => c.baselinePos >= 0 && c.baselinePos < 25);
  const baselineFoundArr = cases.map((c) => c.baselineFound);
  const improvedP1Arr = cases.map((c) => c.improvedPos === 0);
  const improvedP5Arr = cases.map((c) => c.improvedPos >= 0 && c.improvedPos < 5);
  const improvedP10Arr = cases.map((c) => c.improvedPos >= 0 && c.improvedPos < 10);
  const improvedP25Arr = cases.map((c) => c.improvedPos >= 0 && c.improvedPos < 25);
  const improvedFoundArr = cases.map((c) => c.improvedFound);

  const [bP1Pt, bP1Lo, bP1Hi] = bootstrapCI(baselineP1Arr, pctMetric);
  const [bP5Pt, bP5Lo, bP5Hi] = bootstrapCI(baselineP5Arr, pctMetric);
  const [bP10Pt, bP10Lo, bP10Hi] = bootstrapCI(baselineP10Arr, pctMetric);
  const [bP25Pt, bP25Lo, bP25Hi] = bootstrapCI(baselineP25Arr, pctMetric);
  const [bFPt, bFLo, bFHi] = bootstrapCI(baselineFoundArr, pctMetric);
  const [iP1Pt, iP1Lo, iP1Hi] = bootstrapCI(improvedP1Arr, pctMetric);
  const [iP5Pt, iP5Lo, iP5Hi] = bootstrapCI(improvedP5Arr, pctMetric);
  const [iP10Pt, iP10Lo, iP10Hi] = bootstrapCI(improvedP10Arr, pctMetric);
  const [iP25Pt, iP25Lo, iP25Hi] = bootstrapCI(improvedP25Arr, pctMetric);
  const [iFPt, iFLo, iFHi] = bootstrapCI(improvedFoundArr, pctMetric);

  const mcnP1 = mcnemarTest(baselineP1Arr, improvedP1Arr);
  const mcnP5 = mcnemarTest(baselineP5Arr, improvedP5Arr);
  const mcnF = mcnemarTest(baselineFoundArr, improvedFoundArr);

  const effP1 = cohensH(bP1Pt, iP1Pt);
  const effP5 = cohensH(bP5Pt, iP5Pt);
  const effF = cohensH(bFPt, iFPt);

  const diffP1Arr = improvedP1Arr.map((imp, i) => imp && !baselineP1Arr[i]);
  const diffP5Arr = improvedP5Arr.map((imp, i) => imp && !baselineP5Arr[i]);
  const diffFArr = improvedFoundArr.map((imp, i) => imp && !baselineFoundArr[i]);
  const [, dP1Lo, dP1Hi] = bootstrapCI(diffP1Arr, pctMetric);
  const [, dP5Lo, dP5Hi] = bootstrapCI(diffP5Arr, pctMetric);
  const [, dFLo, dFHi] = bootstrapCI(diffFArr, pctMetric);

  const totalElapsed = Date.now() - startTime;

  // API call metrics
  if (apiMetrics.musicbrainzCalls > 0 || apiMetrics.lastfmCalls > 0) {
    console.log("\nAPI CALL METRICS:");
    console.log(`  MusicBrainz: ${apiMetrics.musicbrainzCalls} calls`);
    if (apiMetrics.musicbrainzRateLimits > 0)
      console.log(`    Rate limits: ${apiMetrics.musicbrainzRateLimits} (${((apiMetrics.musicbrainzRateLimits / apiMetrics.musicbrainzCalls) * 100).toFixed(1)}%)`);
    if (apiMetrics.musicbrainzErrors > 0)
      console.log(`    Errors: ${apiMetrics.musicbrainzErrors} (${((apiMetrics.musicbrainzErrors / apiMetrics.musicbrainzCalls) * 100).toFixed(1)}%)`);
    if (apiMetrics.lastfmCalls > 0) {
      console.log(`  Last.fm: ${apiMetrics.lastfmCalls} calls`);
      if (apiMetrics.lastfmErrors > 0)
        console.log(`    Errors: ${apiMetrics.lastfmErrors} (${((apiMetrics.lastfmErrors / apiMetrics.lastfmCalls) * 100).toFixed(1)}%)`);
    }
    if (apiMetrics.totalAPICallTime > 0) {
      const avg = apiMetrics.totalAPICallTime / (apiMetrics.musicbrainzCalls + apiMetrics.lastfmCalls);
      console.log(`  Total API time: ${formatTime(apiMetrics.totalAPICallTime)} (avg: ${formatTime(avg)}/call)`);
    }
    console.log();
  }

  console.log("\n" + "=".repeat(60));
  console.log("EVALUATION RESULTS (DEDUPLICATED)");
  console.log("=".repeat(60));
  console.log(`\nTest set: ${cases.length} unique scrobbles (from ${validScrobblesCount} total with MBIDs)`);
  console.log(`Total scrobbles: ${scrobblesTotal}`);
  console.log(`Deduplication: ${duplicateStats.duplicates} duplicates removed (${(duplicateStats.duplicates / duplicateStats.total * 100).toFixed(1)}%)`);
  if (totalSearches > 0) {
    console.log(`Cache performance: Baseline ${((baselineCacheHits / cases.length) * 100).toFixed(1)}% hits, Improved ${((improvedCacheHits / cases.length) * 100).toFixed(1)}% hits`);
    if (evaluationResultCacheHits > 0)
      console.log(`  Evaluation results: ${evaluationResultCacheHits}/${cases.length} (${((evaluationResultCacheHits / cases.length) * 100).toFixed(1)}% fully cached)`);
  }
  // Per-case API call distribution
  const uncached = cases.filter((c) => !c.improvedCacheHit);
  if (uncached.length > 0) {
    const calls = uncached.map((c) => c.apiCallsImproved).sort((a, b) => a - b);
    const sum = calls.reduce((a, b) => a + b, 0);
    const pct = (p: number) => calls[Math.min(Math.floor(calls.length * p), calls.length - 1)];
    console.log(`API calls/case (n=${calls.length} uncached): mean=${(sum / calls.length).toFixed(2)}, p50=${pct(0.5)}, p90=${pct(0.9)}, p99=${pct(0.99)}, min=${calls[0]}, max=${calls[calls.length - 1]}`);
  }
  console.log(`Total time: ${formatTime(totalElapsed)}`);
  if (cases.length > 0) {
    console.log(`Performance: ${formatTime(totalElapsed / cases.length)}/case, ${(cases.length / (totalElapsed / 1000)).toFixed(2)} cases/sec`);
  }
  console.log();

  const p1Imp = iP1Pt - bP1Pt;
  const p5Imp = iP5Pt - bP5Pt;
  const p10Imp = iP10Pt - bP10Pt;
  const p25Imp = iP25Pt - bP25Pt;
  const fImp = iFPt - bFPt;
  const mrrImp = improvedMRR - baselineMRR;
  const ndcgImp = improvedNDCG - baselineNDCG;

  console.log("BASELINE (Simple Query):");
  console.log(`  Precision@1: ${bP1Pt.toFixed(1)}% [${bP1Lo.toFixed(1)}%, ${bP1Hi.toFixed(1)}%] (${baselineP1}/${cases.length})`);
  console.log(`  Precision@5: ${bP5Pt.toFixed(1)}% [${bP5Lo.toFixed(1)}%, ${bP5Hi.toFixed(1)}%] (${baselineP5}/${cases.length})`);
  console.log(`  Precision@10: ${bP10Pt.toFixed(1)}% [${bP10Lo.toFixed(1)}%, ${bP10Hi.toFixed(1)}%] (${baselineP10}/${cases.length})`);
  console.log(`  Precision@25: ${bP25Pt.toFixed(1)}% [${bP25Lo.toFixed(1)}%, ${bP25Hi.toFixed(1)}%] (${baselineP25}/${cases.length})`);
  console.log(`  Findability: ${bFPt.toFixed(1)}% [${bFLo.toFixed(1)}%, ${bFHi.toFixed(1)}%] (${baselineFound}/${cases.length})`);
  console.log(`  MRR: ${baselineMRR.toFixed(3)}, NDCG@25: ${baselineNDCG.toFixed(3)}\n`);

  const configDesc = [
    searchConfig.enableCleaning ? "cleaning" : "no-cleaning",
    searchConfig.enableFuzzy ? "fuzzy" : "no-fuzzy",
    searchConfig.enableMultiStage ? "multistage" : "no-multistage",
  ].join(" + ");

  console.log(`IMPROVED (${configDesc}):`);
  console.log(`  Precision@1: ${iP1Pt.toFixed(1)}% [${iP1Lo.toFixed(1)}%, ${iP1Hi.toFixed(1)}%] (${improvedP1}/${cases.length})`);
  console.log(`  Precision@5: ${iP5Pt.toFixed(1)}% [${iP5Lo.toFixed(1)}%, ${iP5Hi.toFixed(1)}%] (${improvedP5}/${cases.length})`);
  console.log(`  Precision@10: ${iP10Pt.toFixed(1)}% [${iP10Lo.toFixed(1)}%, ${iP10Hi.toFixed(1)}%] (${improvedP10}/${cases.length})`);
  console.log(`  Precision@25: ${iP25Pt.toFixed(1)}% [${iP25Lo.toFixed(1)}%, ${iP25Hi.toFixed(1)}%] (${improvedP25}/${cases.length})`);
  console.log(`  Findability: ${iFPt.toFixed(1)}% [${iFLo.toFixed(1)}%, ${iFHi.toFixed(1)}%] (${improvedFound}/${cases.length})`);
  console.log(`  MRR: ${improvedMRR.toFixed(3)}, NDCG@25: ${improvedNDCG.toFixed(3)}\n`);

  console.log("IMPROVEMENT (Primary Metrics):");
  console.log(`  Precision@1: ${p1Imp > 0 ? "+" : ""}${p1Imp.toFixed(1)}% [${dP1Lo.toFixed(1)}%, ${dP1Hi.toFixed(1)}%]`);
  console.log(`  Precision@5: ${p5Imp > 0 ? "+" : ""}${p5Imp.toFixed(1)}% [${dP5Lo.toFixed(1)}%, ${dP5Hi.toFixed(1)}%]`);
  console.log(`  Precision@10: ${p10Imp > 0 ? "+" : ""}${p10Imp.toFixed(1)}%`);
  console.log(`  Precision@25: ${p25Imp > 0 ? "+" : ""}${p25Imp.toFixed(1)}%`);
  console.log(`  Findability: ${fImp > 0 ? "+" : ""}${fImp.toFixed(1)}% [${dFLo.toFixed(1)}%, ${dFHi.toFixed(1)}%]`);
  console.log(`  MRR: ${mrrImp > 0 ? "+" : ""}${mrrImp.toFixed(3)}, NDCG@25: ${ndcgImp > 0 ? "+" : ""}${ndcgImp.toFixed(3)}`);

  console.log("\nSTATISTICAL SIGNIFICANCE:");
  console.log(`  P@1: ${mcnP1.significant ? "SIGNIFICANT" : "not significant"} (p=${mcnP1.pValue.toFixed(4)})`);
  console.log(`  P@5: ${mcnP5.significant ? "SIGNIFICANT" : "not significant"} (p=${mcnP5.pValue.toFixed(4)})`);
  console.log(`  Findability: ${mcnF.significant ? "SIGNIFICANT" : "not significant"} (p=${mcnF.pValue.toFixed(4)})`);
  console.log(`  Effect size (Cohen's h): P@1=${effP1.toFixed(3)}, P@5=${effP5.toFixed(3)}, Found=${effF.toFixed(3)}\n`);

  // Effective metrics
  const matchable = cases.filter((c) => c.baselineFound || c.improvedFound);
  const unmatchable = cases.filter((c) => !c.baselineFound && !c.improvedFound);

  if (matchable.length > 0 && unmatchable.length > 0) {
    console.log("EFFECTIVE METRICS (excluding unmatchable cases):");
    console.log(`  Unmatchable: ${unmatchable.length}/${cases.length} (${(unmatchable.length / cases.length * 100).toFixed(1)}%)`);
    console.log(`  Effective baseline P@1: ${(matchable.filter((c) => c.baselinePos === 0).length / matchable.length * 100).toFixed(1)}%`);
    console.log(`  Effective improved P@1: ${(matchable.filter((c) => c.improvedPos === 0).length / matchable.length * 100).toFixed(1)}%\n`);
  }

  // Work-equivalence
  const workEquiv = cases.filter((c) => c.workEquivalentPos >= 0);
  if (workEquiv.length > 0) {
    const disambiguatable = unmatchable.filter((c) => c.workEquivalentPos >= 0);
    const trulyUnmatchable = unmatchable.filter((c) => c.workEquivalentPos < 0);
    console.log("RECORDING DISAMBIGUATION (work-equivalence):");
    console.log(`  Cases with same work, different recording: ${workEquiv.length}`);
    console.log(`  Adjusted unmatchable rate: ${(trulyUnmatchable.length / cases.length * 100).toFixed(1)}% (was ${(unmatchable.length / cases.length * 100).toFixed(1)}%)\n`);
  }

  console.log("COMPARATIVE PERFORMANCE:");
  console.log(`  Baseline better: ${baselineBetter}, Improved better: ${improvedBetter}, Same: ${bothSame}`);
  if (cases.length > 0) {
    console.log(`  Improved win rate: ${(improvedBetter / cases.length * 100).toFixed(1)}%\n`);
  }

  // Position distribution
  const bPosDist = {
    notFound: baselinePositions.filter((p) => p === -1).length,
    pos1: baselinePositions.filter((p) => p === 0).length,
    pos2to5: baselinePositions.filter((p) => p >= 1 && p < 5).length,
    pos6to10: baselinePositions.filter((p) => p >= 5 && p < 10).length,
    pos11to25: baselinePositions.filter((p) => p >= 10 && p < 25).length,
  };
  const iPosDist = {
    notFound: improvedPositions.filter((p) => p === -1).length,
    pos1: improvedPositions.filter((p) => p === 0).length,
    pos2to5: improvedPositions.filter((p) => p >= 1 && p < 5).length,
    pos6to10: improvedPositions.filter((p) => p >= 5 && p < 10).length,
    pos11to25: improvedPositions.filter((p) => p >= 10 && p < 25).length,
  };

  console.log("POSITION DISTRIBUTION:");
  console.log("  Baseline:");
  console.log(`    Not found: ${bPosDist.notFound} (${(bPosDist.notFound / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 1: ${bPosDist.pos1} (${(bPosDist.pos1 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 2-5: ${bPosDist.pos2to5} (${(bPosDist.pos2to5 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 6-10: ${bPosDist.pos6to10} (${(bPosDist.pos6to10 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 11-25: ${bPosDist.pos11to25} (${(bPosDist.pos11to25 / cases.length * 100).toFixed(1)}%)`);
  console.log("  Improved:");
  console.log(`    Not found: ${iPosDist.notFound} (${(iPosDist.notFound / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 1: ${iPosDist.pos1} (${(iPosDist.pos1 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 2-5: ${iPosDist.pos2to5} (${(iPosDist.pos2to5 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 6-10: ${iPosDist.pos6to10} (${(iPosDist.pos6to10 / cases.length * 100).toFixed(1)}%)`);
  console.log(`    Position 11-25: ${iPosDist.pos11to25} (${(iPosDist.pos11to25 / cases.length * 100).toFixed(1)}%)\n`);

  // Hardness-stratified metrics
  const hardnessStats: Record<string, { count: number; bP1: number; iP1: number; bP5: number; iP5: number; bF: number; iF: number }> = {
    easy: { count: 0, bP1: 0, iP1: 0, bP5: 0, iP5: 0, bF: 0, iF: 0 },
    medium: { count: 0, bP1: 0, iP1: 0, bP5: 0, iP5: 0, bF: 0, iF: 0 },
    hard: { count: 0, bP1: 0, iP1: 0, bP5: 0, iP5: 0, bF: 0, iF: 0 },
  };
  for (const c of cases) {
    const h = c.hardness || "medium";
    const s = hardnessStats[h];
    s.count++;
    if (c.baselinePos === 0) s.bP1++;
    if (c.improvedPos === 0) s.iP1++;
    if (c.baselinePos >= 0 && c.baselinePos < 5) s.bP5++;
    if (c.improvedPos >= 0 && c.improvedPos < 5) s.iP5++;
    if (c.baselineFound) s.bF++;
    if (c.improvedFound) s.iF++;
  }

  console.log("QUERY HARDNESS-STRATIFIED METRICS:\n");
  for (const [level, s] of Object.entries(hardnessStats)) {
    if (s.count === 0) continue;
    const bP1 = (s.bP1 / s.count * 100).toFixed(1);
    const iP1 = (s.iP1 / s.count * 100).toFixed(1);
    const bP5 = (s.bP5 / s.count * 100).toFixed(1);
    const iP5 = (s.iP5 / s.count * 100).toFixed(1);
    const bFound = (s.bF / s.count * 100).toFixed(1);
    const iFound = (s.iF / s.count * 100).toFixed(1);
    console.log(`  ${level.toUpperCase()} (${s.count} cases, ${(s.count / cases.length * 100).toFixed(1)}%):`);
    console.log(`    Baseline: P@1=${bP1}%, P@5=${bP5}%, Found=${bFound}%`);
    console.log(`    Improved: P@1=${iP1}%, P@5=${iP5}%, Found=${iFound}%\n`);
  }

  // Failure mode analysis
  const failureModes = ["featuring", "remix", "live", "parenthetical", "special_chars", "short_name", "standard"];
  console.log("STRATIFIED FAILURE MODE ANALYSIS:\n");
  for (const mode of failureModes) {
    const modeCases = cases.filter((c) => c.failureMode === mode);
    if (modeCases.length === 0) continue;
    const bP1 = (modeCases.filter((c) => c.baselinePos === 0).length / modeCases.length * 100).toFixed(1);
    const iP1 = (modeCases.filter((c) => c.improvedPos === 0).length / modeCases.length * 100).toFixed(1);
    const bF = (modeCases.filter((c) => c.baselineFound).length / modeCases.length * 100).toFixed(1);
    const iF = (modeCases.filter((c) => c.improvedFound).length / modeCases.length * 100).toFixed(1);
    console.log(`  ${mode.toUpperCase().replace(/_/g, " ")} (${modeCases.length} cases):`);
    console.log(`    Baseline: P@1=${bP1}%, Found=${bF}%`);
    console.log(`    Improved: P@1=${iP1}%, Found=${iF}%\n`);
  }

  // Improvement examples
  const improvements = cases.filter(
    (c) => (!c.baselineFound && c.improvedFound) || (c.baselineFound && c.improvedFound && c.improvedPos < c.baselinePos),
  );
  if (improvements.length > 0) {
    console.log(`IMPROVEMENT EXAMPLES (${Math.min(5, improvements.length)} of ${improvements.length}):`);
    for (let i = 0; i < Math.min(5, improvements.length); i++) {
      const ex = improvements[i];
      console.log(`  "${ex.track}" by ${ex.artist || "[no artist]"}`);
      console.log(`    Baseline: ${ex.baselineFound ? `position ${ex.baselinePos + 1}` : "not found"}`);
      console.log(`    Improved: ${ex.improvedFound ? `position ${ex.improvedPos + 1}` : "not found"}`);
    }
  }

  // Regression examples
  const regressions = cases.filter(
    (c) => (c.baselineFound && !c.improvedFound) || (c.baselineFound && c.improvedFound && c.baselinePos < c.improvedPos),
  );
  if (regressions.length > 0) {
    console.log(`\nREGRESSION EXAMPLES (${Math.min(3, regressions.length)} of ${regressions.length}):`);
    for (let i = 0; i < Math.min(3, regressions.length); i++) {
      const ex = regressions[i];
      console.log(`  "${ex.track}" by ${ex.artist}`);
      console.log(`    Baseline: ${ex.baselineFound ? `position ${ex.baselinePos + 1}` : "not found"}`);
      console.log(`    Improved: ${ex.improvedFound ? `position ${ex.improvedPos + 1}` : "not found"}`);
    }
  }

  // Save results JSON
  const archiveDir = join(process.cwd(), "scripts", "eval", "results", "archive", new Date().toISOString().split("T")[0]);
  mkdirSync(archiveDir, { recursive: true });
  const resultsFile = join(archiveDir, "lastfm-evaluation-results.json");
  writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        scrobbles_total: scrobblesTotal,
        scrobbles_with_mbid: validScrobblesCount,
        deduplication: { ...duplicateStats, distribution: duplicateDistribution },
        metrics: {
          baseline_p1: bP1Pt, baseline_p5: bP5Pt, baseline_p10: bP10Pt, baseline_p25: bP25Pt,
          baseline_findability: bFPt,
          improved_p1: iP1Pt, improved_p5: iP5Pt, improved_p10: iP10Pt, improved_p25: iP25Pt,
          improved_findability: iFPt,
          p1_improvement: p1Imp, p5_improvement: p5Imp, p10_improvement: p10Imp,
          p25_improvement: p25Imp, findability_improvement: fImp,
          baseline_mrr: baselineMRR, improved_mrr: improvedMRR, mrr_improvement: mrrImp,
          baseline_ndcg: baselineNDCG, improved_ndcg: improvedNDCG, ndcg_improvement: ndcgImp,
          baseline_better: baselineBetter, improved_better: improvedBetter, same_result: bothSame,
          avg_api_calls_improved: (() => {
            const uncached = cases.filter((c) => !c.improvedCacheHit);
            if (uncached.length === 0) return null;
            const sum = uncached.reduce((a, c) => a + c.apiCallsImproved, 0);
            return Math.round((sum / uncached.length) * 100) / 100;
          })(),
        },
        api_metrics: {
          musicbrainz_calls: apiMetrics.musicbrainzCalls,
          musicbrainz_rate_limits: apiMetrics.musicbrainzRateLimits,
          musicbrainz_errors: apiMetrics.musicbrainzErrors,
          lastfm_calls: apiMetrics.lastfmCalls,
          lastfm_errors: apiMetrics.lastfmErrors,
          total_api_call_time_ms: apiMetrics.totalAPICallTime,
        },
        cases: cases.map((c) => ({
          track: c.track, artist: c.artist, album: c.album, mbid: c.mbid,
          baseline_pos: c.baselinePos >= 0 ? c.baselinePos + 1 : null,
          improved_pos: c.improvedPos >= 0 ? c.improvedPos + 1 : null,
          baseline_found: c.baselineFound, improved_found: c.improvedFound,
          failure_mode: c.failureMode, hardness: c.hardness,
          matchability: c.baselineFound || c.improvedFound ? "matchable"
            : c.workEquivalentPos >= 0 ? "work_equivalent" : "unmatchable",
          field_combination: c.fieldCombination, duplicate_count: c.duplicateCount,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`\nResults saved to: ${resultsFile}`);
}
