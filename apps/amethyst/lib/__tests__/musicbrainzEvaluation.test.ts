import { pairedRateIntervals } from "../../../../scripts/eval/statistics";

const aWin = { recordingId: "one", baseline: false, improved: true };
const aLoss = { recordingId: "one", baseline: true, improved: false };
const bWin = { ...aWin, recordingId: "two" };
const bLoss = { ...aLoss, recordingId: "two" };

describe("paired search rate intervals", () => {
  it("keeps losses when two systems trade first place", () => {
    const { difference } = pairedRateIntervals([aLoss, bWin]);
    expect(difference).toEqual({ point: 0, low: -100, high: 100 });
  });

  it("keeps both query variants from each recording in the same draw", () => {
    const { difference } = pairedRateIntervals([aLoss, aWin, bWin, bLoss]);
    expect(difference).toEqual({ point: 0, low: 0, high: 0 });
  });

  it("weights the point estimate by queries even when cluster sizes differ", () => {
    const result = pairedRateIntervals([aLoss, aLoss, bWin]);
    expect(result.baseline.point).toBeCloseTo(200 / 3);
    expect(result.improved.point).toBeCloseTo(100 / 3);
    expect(result.difference.point).toBeCloseTo(-100 / 3);
  });

  it("reports uniform regressions as a negative change", () => {
    const { difference } = pairedRateIntervals([aLoss, bLoss]);
    expect(difference).toEqual({ point: -100, low: -100, high: -100 });
  });
});
