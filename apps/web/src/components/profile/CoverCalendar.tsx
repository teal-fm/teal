import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getListeningCalendar } from "@teal/client/teal/api";
import { isoDay, mondayOffset, monthRange } from "@teal/client/teal/calendar";
import { cn } from "@teal/client/utils";
import { AmbientSource, Button, Cover, coverUri, Glass, Heading, Icon } from "~/ds";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** A month of covers: each day shows the album played most. */
export function CoverCalendar({ actor, name }: { actor: string; name: string }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [from, to] = monthRange(cursor.year, cursor.month);
  const calendar = useQuery({
    queryKey: ["calendar", actor, from, to],
    queryFn: () => getListeningCalendar(actor, from, to),
    staleTime: 5 * 60_000,
  });
  const offset = mondayOffset(cursor.year, cursor.month);
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: cursor.year === now.getFullYear() ? undefined : "numeric",
  });
  const isCurrent = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const step = (delta: number) =>
    setCursor(({ year, month }) => {
      const date = new Date(year, month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  const days = calendar.data?.days ?? [];
  const today = isoDay(now);
  const topCover = days.find((d) => d.topRelease?.releaseMbId)?.topRelease?.releaseMbId;

  return (
    <AmbientSource uri={coverUri(topCover)}>
      <Glass as="section" className="flex flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between">
          <Heading level={2} className="text-[20px]" suppressHydrationWarning>
            {title}
          </Heading>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-full bg-fill hover:brightness-95">
              <Icon icon={ChevronLeft} size={17} className="text-tint" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={isCurrent}
              aria-label="Next month"
              className="flex size-8 items-center justify-center rounded-full bg-fill hover:brightness-95 disabled:opacity-40"
            >
              <Icon icon={ChevronRight} size={17} className="text-tint" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-[5px]">
          {WEEKDAYS.map((d, i) => (
            <span key={i} aria-hidden className="pb-0.5 text-center text-[11.5px] font-semibold text-ink-2">
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map((day, i) => (
            <span
              key={day.date}
              className={cn(
                "relative aspect-square overflow-hidden rounded-[7px]",
                day.date > today ? "border border-hair" : "bg-fill",
              )}
            >
              {day.topRelease?.releaseMbId ? (
                <Cover
                  releaseMbId={day.topRelease.releaseMbId}
                  radius={7}
                  className="absolute inset-0"
                  label={`${title} ${i + 1}: ${day.topRelease.releaseName}, ${day.playCount} plays`}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "absolute top-0.5 left-1 text-[10.5px] font-bold",
                  day.topRelease ? "text-white [text-shadow:0_0_3px_rgba(0,0,0,0.6)]" : "text-ink-2",
                )}
              >
                {i + 1}
              </span>
            </span>
          ))}
        </div>
        {calendar.isError ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[13px] text-ink-2">This month's listening didn't load.</p>
            <Button label="Try again" size="sm" variant="secondary" onClick={() => calendar.refetch()} />
          </div>
        ) : (
          <p className="text-[13px] text-ink-2">Each day is the album {name} played most.</p>
        )}
      </Glass>
    </AmbientSource>
  );
}
