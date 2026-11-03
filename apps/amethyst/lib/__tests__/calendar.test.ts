import { hourBins, isoDay, lastDays, mondayOffset, monthRange } from "../teal/calendar";

describe("calendar helpers", () => {
  it("formats local days and ranges", () => {
    expect(isoDay(new Date(2026, 10, 3))).toBe("2026-11-03");
    expect(lastDays(31, new Date(2026, 10, 3))).toEqual(["2026-10-04", "2026-11-03"]);
    expect(monthRange(2026, 9)).toEqual(["2026-10-01", "2026-10-31"]);
    expect(monthRange(2024, 1)).toEqual(["2024-02-01", "2024-02-29"]);
  });

  it("starts weeks on Monday", () => {
    expect(mondayOffset(2026, 9)).toBe(3); // 1 October 2026 is a Thursday
    expect(mondayOffset(2026, 5)).toBe(0); // 1 June 2026 is a Monday
  });

  it("folds hours into two-hour bins keeping the busiest release", () => {
    const bins = hourBins({
      date: "2026-11-03",
      playCount: 9,
      hours: [
        { hour: 20, playCount: 2, releaseMbId: "a" },
        { hour: 21, playCount: 5, releaseMbId: "b" },
        { hour: 7, playCount: 2 },
      ],
    });
    expect(bins).toHaveLength(12);
    expect(bins[10]).toEqual({ playCount: 7, releaseMbId: "b" });
    expect(bins[3]).toEqual({ playCount: 2, releaseMbId: undefined });
    expect(bins[0]).toEqual({ playCount: 0, releaseMbId: undefined });
  });
});
