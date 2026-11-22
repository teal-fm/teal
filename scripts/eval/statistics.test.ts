import assert from "node:assert/strict";
import test from "node:test";
import { pairedRateIntervals } from "./statistics.ts";

const pairs = [
  { recordingId: "first", baseline: false, improved: true },
  { recordingId: "second", baseline: true, improved: false },
];

test("paired intervals count losses as well as wins", (t) => {
  const draws = [0, 0, 0, 0.75, 0.75, 0, 0.75, 0.75];
  let draw = 0;
  t.mock.method(Math, "random", () => draws[draw++ % draws.length]);

  const intervals = pairedRateIntervals(pairs);
  assert.deepEqual(intervals.difference, { point: 0, low: -100, high: 100 });
});

test("repeating query variants does not narrow recording-level intervals", (t) => {
  const draws = [0, 0, 0, 0.75, 0.75, 0, 0.75, 0.75];
  let draw = 0;
  t.mock.method(Math, "random", () => draws[draw++ % draws.length]);

  const single = pairedRateIntervals(pairs);
  const repeated = pairedRateIntervals(Array.from({ length: 50 }, () => pairs).flat());
  assert.deepEqual(repeated, single);
});
