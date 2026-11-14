import { useQuery } from "@tanstack/react-query";
import { getListeningCalendar } from "@teal/client/teal/api";
import { hourBins, lastDays } from "@teal/client/teal/calendar";
import { coverUri } from "~/ds";

const DAYS = 31;
const ROWS = 12;

/**
 * A listening fingerprint: the last 31 days as columns, two-hour slots as rows, each
 * filled with a crop of the cover that dominated it. Unique to every listener.
 * Fills its parent's height.
 */
export function Fingerprint({ actor }: { actor: string }) {
  const [from, to] = lastDays(DAYS);
  const calendar = useQuery({
    queryKey: ["calendar", actor, from, to],
    queryFn: () => getListeningCalendar(actor, from, to),
    staleTime: 5 * 60_000,
  });
  const days = calendar.data?.days ?? [];
  const peak = Math.max(1, ...days.flatMap((d) => hourBins(d, ROWS).map((b) => b.playCount)));

  return (
    <div
      className="relative h-full"
      role="img"
      aria-label="Listening fingerprint: the last 31 days by hour, each slot showing the album played most"
    >
      <div
        className="grid size-full gap-0.5"
        style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`, gridAutoFlow: "column" }}
      >
        {Array.from({ length: DAYS }, (_, d) =>
          hourBins(days[d], ROWS).map((bin, r) => (
            <span key={`${d}-${r}`} className={bin.playCount ? "overflow-hidden rounded-[3px] bg-fill" : "rounded-[3px] bg-fill opacity-60"}>
              {bin.playCount && bin.releaseMbId ? (
                <img
                  src={coverUri(bin.releaseMbId, 250)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                  style={{ opacity: 0.45 + 0.55 * (bin.playCount / peak) }}
                />
              ) : null}
            </span>
          )),
        )}
      </div>
      {calendar.isError ? (
        <button
          type="button"
          onClick={() => calendar.refetch()}
          className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white"
        >
          Listening didn't load · Try again
        </button>
      ) : (
        <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white">
          last {DAYS} days, by hour
        </span>
      )}
    </div>
  );
}
