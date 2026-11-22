import { pairedRateIntervals } from "../../../../scripts/eval/statistics";

describe("paired search rate intervals", () => {
  it("keeps losses when two systems trade first place", () => {
    const ids = ["one", "two"];
    const { difference } = pairedRateIntervals(ids, [true, false], [false, true]);
    expect(difference).toEqual([0, -100, 100]);
  });

  it("keeps both query variants from each recording in the same draw", () => {
    const { difference } = pairedRateIntervals(
      ["one", "one", "two", "two"],
      [true, false, false, true],
      [false, true, true, false],
    );
    expect(difference).toEqual([0, 0, 0]);
  });

  it("weights the point estimate by queries even when cluster sizes differ", () => {
    const result = pairedRateIntervals(
      ["one", "one", "two"],
      [true, true, false],
      [false, false, true],
    );
    expect(result.baseline[0]).toBeCloseTo(200 / 3);
    expect(result.improved[0]).toBeCloseTo(100 / 3);
    expect(result.difference[0]).toBeCloseTo(-100 / 3);
  });

  it("reports uniform regressions as a negative change", () => {
    const result = pairedRateIntervals(["one", "two"], [true, true], [false, false]);
    expect(result.difference).toEqual([-100, -100, -100]);
  });
});
