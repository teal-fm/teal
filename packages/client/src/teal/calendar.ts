import type { ListeningDay } from "./api";

/** YYYY-MM-DD in local time. */
export function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `days` days ending today, as an inclusive [from, to] pair. */
export function lastDays(days: number, today = new Date()) {
  const from = new Date(today);
  from.setDate(today.getDate() - (days - 1));
  return [isoDay(from), isoDay(today)] as const;
}

/** First and last day of a month (month is 0-based). */
export function monthRange(year: number, month: number) {
  return [isoDay(new Date(year, month, 1)), isoDay(new Date(year, month + 1, 0))] as const;
}

/** Empty cells before the 1st so weeks start on Monday. */
export function mondayOffset(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export type Bin = { playCount: number; releaseMbId?: string };

/**
 * Folds a day's hours into `count` equal bins (12 = two-hour rows). Each bin keeps
 * the release from its busiest hour, so the fingerprint shows what dominated it.
 */
export function hourBins(day: ListeningDay | undefined, count = 12): Bin[] {
  const size = 24 / count;
  const bins: (Bin & { best: number })[] = Array.from({ length: count }, () => ({
    playCount: 0,
    best: 0,
  }));
  for (const hour of day?.hours ?? []) {
    const bin = bins[Math.floor(hour.hour / size)];
    bin.playCount += hour.playCount;
    if (hour.releaseMbId && hour.playCount > bin.best) {
      bin.best = hour.playCount;
      bin.releaseMbId = hour.releaseMbId;
    }
  }
  return bins.map(({ playCount, releaseMbId }) => ({ playCount, releaseMbId }));
}
