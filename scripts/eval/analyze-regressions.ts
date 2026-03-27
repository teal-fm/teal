/**
 * Quick analysis of eval regressions and unmatchable disambiguation cases.
 * Run: npx tsx scripts/eval/analyze-regressions.ts
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const resultsDir = new URL(".", import.meta.url).pathname;

// Find the most recent results file
const archiveDir = join(resultsDir, "results/archive");
const dateDirs = readdirSync(archiveDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
if (dateDirs.length === 0) {
  console.error("No eval results found in", archiveDir);
  process.exit(1);
}
const latestDate = dateDirs[0];
const resultsPath = join(archiveDir, latestDate, "lastfm-evaluation-results.json");
console.log(`Using results from: ${latestDate}\n`);
const data = JSON.parse(readFileSync(resultsPath, "utf-8"));
const cases = data.cases;

console.log("=== REGRESSION ANALYSIS ===\n");

// Easy cases where baseline P@1 but improved is not
const easyRegressions = cases.filter((c: any) =>
  c.hardness === "easy" && c.baseline_pos === 0 && c.improved_pos !== 0
);
console.log(`Easy P@1 regressions: ${easyRegressions.length}`);
for (const c of easyRegressions.slice(0, 15)) {
  console.log(`  "${c.track}" by ${c.artist || "[no artist]"}`);
  console.log(`    baseline: pos 0 -> improved: pos ${c.improved_pos}`);
  console.log(`    failure: ${c.failure_mode}`);
}

// Cases lost entirely (baseline found, improved not)
const lostCases = cases.filter((c: any) => c.baseline_found && !c.improved_found);
console.log(`\nCases lost entirely (baseline found, improved not): ${lostCases.length}`);
for (const c of lostCases.slice(0, 5)) {
  console.log(`  "${c.track}" by ${c.artist || "[no artist]"}`);
  console.log(`    baseline pos: ${c.baseline_pos}`);
}

// All regressions (improved worse than baseline)
const allRegressions = cases.filter((c: any) => {
  if (!c.baseline_found) return false;
  if (!c.improved_found) return true;
  return c.improved_pos > c.baseline_pos;
});
console.log(`\nAll regressions (any worsening): ${allRegressions.length}`);
console.log(`  Lost entirely: ${allRegressions.filter((c: any) => !c.improved_found).length}`);
console.log(`  Position worsened: ${allRegressions.filter((c: any) => c.improved_found && c.improved_pos > c.baseline_pos).length}`);

// Group regressions by failure mode
const regByMode: Record<string, number> = {};
for (const c of allRegressions) {
  const mode = (c as any).failure_mode || "unknown";
  regByMode[mode] = (regByMode[mode] || 0) + 1;
}
console.log("  By failure mode:", JSON.stringify(regByMode));

// Show the worst regressions (biggest position drop)
const positionRegressions = allRegressions
  .filter((c: any) => c.improved_found)
  .map((c: any) => ({ ...c, drop: c.improved_pos - c.baseline_pos }))
  .sort((a: any, b: any) => b.drop - a.drop);
console.log("\nWorst position drops:");
for (const c of positionRegressions.slice(0, 10)) {
  console.log(`  "${c.track}" by ${c.artist || "[no artist]"}`);
  console.log(`    pos ${c.baseline_pos} -> ${c.improved_pos} (drop: ${c.drop}), failure: ${c.failure_mode}`);
}

console.log("\n=== UNMATCHABLE ANALYSIS ===\n");

const unmatchable = cases.filter((c: any) => c.matchability === "unmatchable");
console.log(`Total unmatchable: ${unmatchable.length} / ${cases.length} (${(unmatchable.length / cases.length * 100).toFixed(1)}%)`);

// Break down by artist presence
const withArtist = unmatchable.filter((c: any) => c.artist);
const noArtist = unmatchable.filter((c: any) => !c.artist);
console.log(`  With artist: ${withArtist.length}`);
console.log(`  Track-only (no artist): ${noArtist.length}`);

// By failure mode
const unmatchByMode: Record<string, number> = {};
for (const c of unmatchable) {
  const mode = (c as any).failure_mode || "unknown";
  unmatchByMode[mode] = (unmatchByMode[mode] || 0) + 1;
}
console.log(`  By failure mode:`, JSON.stringify(unmatchByMode));

// Sample some unmatchable with artist (the disambiguation candidates)
console.log("\nSample unmatchable (track+artist) -- likely disambiguation:");
for (const c of withArtist.slice(0, 10)) {
  console.log(`  "${c.track}" by ${c.artist} [mbid: ${c.mbid?.slice(0, 8)}...]`);
}
