import assert from "node:assert/strict";
import test from "node:test";
import { pairedRateIntervals } from "./statistics.ts";

test("paired intervals count losses as well as wins", (t) => {
  const draws = [0, 0, 0, 0.75, 0.75, 0, 0.75, 0.75];
  let draw = 0;
  t.mock.method(Math, "random", () => draws[draw++ % draws.length]);

  const intervals = pairedRateIntervals(["first", "second"], [false, true], [true, false]);

  assert.deepEqual(intervals.difference, [0, -100, 100]);
});

test("repeating query variants does not narrow recording-level intervals", (t) => {
  const draws = [0, 0, 0, 0.75, 0.75, 0, 0.75, 0.75];
  let draw = 0;
  t.mock.method(Math, "random", () => draws[draw++ % draws.length]);

  const single = pairedRateIntervals(["first", "second"], [false, true], [true, false]);
  const repeated = pairedRateIntervals(
    [...Array(50).fill("first"), ...Array(50).fill("second")],
    [...Array(50).fill(false), ...Array(50).fill(true)],
    [...Array(50).fill(true), ...Array(50).fill(false)],
  );

  assert.deepEqual(repeated, single);
});
