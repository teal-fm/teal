import { useState } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AmbientSource, Cover, coverUri, Glass } from "@/components/ds";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { getListeningCalendar } from "@/lib/teal/api";
import { isoDay, mondayOffset, monthRange } from "@/lib/teal/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
// Seven columns; widths are set as styles so they apply on every platform.
const COLUMN = { width: `${100 / 7}%` } as const;
const CELL = { width: `${100 / 7}%`, padding: 2.5 } as const;

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
      <Glass className="gap-2.5 p-4">
        <View className="flex-row items-center justify-between">
          <Text role="heading" aria-level={2} className="text-[20px] font-bold text-ink">
            {title}
          </Text>
          <View className="flex-row gap-1.5">
            <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Previous month" className="h-8 w-8 items-center justify-center rounded-full bg-fill">
              <Icon icon={ChevronLeft} size={17} className="text-tint" />
            </Pressable>
            <Pressable
              onPress={() => step(1)}
              disabled={isCurrent}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              className="h-8 w-8 items-center justify-center rounded-full bg-fill disabled:opacity-40"
            >
              <Icon icon={ChevronRight} size={17} className="text-tint" />
            </Pressable>
          </View>
        </View>
        <View className="flex-row flex-wrap">
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={COLUMN}>
              <Text className="pb-0.5 text-center text-[11.5px] font-semibold text-ink-2">{d}</Text>
            </View>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <View key={`pad-${i}`} style={CELL} />
          ))}
          {days.map((day, i) => (
            <View key={day.date} style={CELL}>
              <View
                className={
                  day.date > today
                    ? "aspect-square overflow-hidden rounded-[7px] border border-hair"
                    : "aspect-square overflow-hidden rounded-[7px] bg-fill"
                }
              >
                {day.topRelease?.releaseMbId ? (
                  <Cover
                    releaseMbId={day.topRelease.releaseMbId}
                    size={undefined}
                    radius={7}
                    className="absolute inset-0"
                    accessibilityLabel={`${title} ${i + 1}: ${day.topRelease.releaseName}, ${day.playCount} plays`}
                  />
                ) : null}
                <Text
                  className={
                    day.topRelease ? "absolute left-1 top-0.5 text-[10.5px] font-bold text-white" : "absolute left-1 top-0.5 text-[10.5px] font-bold text-ink-2"
                  }
                  style={day.topRelease ? { textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 } : undefined}
                >
                  {i + 1}
                </Text>
              </View>
            </View>
          ))}
        </View>
        {calendar.isError ? (
          <View className="items-start gap-2">
            <Text className="text-[13px] text-ink-2">This month's listening didn't load.</Text>
            <Pressable onPress={() => calendar.refetch()} accessibilityRole="button" className="rounded-full bg-fill px-3.5 py-1.5">
              <Text className="text-[13px] font-semibold text-ink">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <Text className="text-[13px] text-ink-2">Each day is the album {name} played most.</Text>
        )}
      </Glass>
    </AmbientSource>
  );
}
