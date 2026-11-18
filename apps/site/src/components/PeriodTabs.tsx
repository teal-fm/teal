import { Link } from "@tanstack/react-router";

import { PERIOD_LABELS, type Period } from "~/lib/types";

export function PeriodTabs({
  value,
  periods,
}: {
  value: Period;
  periods: Period[];
}) {
  return (
    <nav
      aria-label="Period"
      className="flex flex-wrap gap-1 rounded-full bg-black/5 p-1 dark:bg-white/5"
    >
      {periods.map((period) => (
        <Link
          key={period}
          to="."
          search={(prev: Record<string, unknown>) => ({ ...prev, period })}
          replace
          resetScroll={false}
          aria-current={period === value ? "page" : undefined}
          className="rounded-full px-3 py-1 text-sm transition-colors hover:bg-black/5 aria-[current=page]:bg-teal-500 aria-[current=page]:text-white dark:hover:bg-white/10"
        >
          {PERIOD_LABELS[period]}
        </Link>
      ))}
    </nav>
  );
}
