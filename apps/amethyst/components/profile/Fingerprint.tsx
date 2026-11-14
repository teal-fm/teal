import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { getListeningCalendar } from "@teal/client/teal/api";
import { hourBins, lastDays } from "@teal/client/teal/calendar";
import { Text, coverUri } from "@/components/ds";

const DAYS = 31;
const ROWS = 12;
const GAP = 2;

/**
 * A listening fingerprint: the last 31 days as columns, two-hour slots as rows, each
 * filled with a crop of the cover that dominated it. Unique to every listener.
 */
export function Fingerprint({ actor, height = 168 }: { actor: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const [from, to] = lastDays(DAYS);
  const calendar = useQuery({
    queryKey: ["calendar", actor, from, to],
    queryFn: () => getListeningCalendar(actor, from, to),
    staleTime: 5 * 60_000,
  });
  const days = calendar.data?.days ?? [];
  const cell = width ? (width - GAP * (DAYS - 1)) / DAYS : 0;
  const rowHeight = (height - GAP * (ROWS - 1)) / ROWS;
  const peak = Math.max(1, ...days.flatMap((d) => hourBins(d, ROWS).map((b) => b.playCount)));

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="image"
      accessibilityLabel="Listening fingerprint: the last 31 days by hour, each slot showing the album played most"
    >
      {width > 0 ? (
        <View className="flex-row" style={{ gap: GAP }}>
          {Array.from({ length: DAYS }, (_, d) => {
            const bins = hourBins(days[d], ROWS);
            return (
              <View key={d} style={{ width: cell, gap: GAP }}>
                {bins.map((bin, r) => (
                  <View
                    key={r}
                    style={{ height: rowHeight, borderRadius: Math.min(3, cell / 3) }}
                    className={bin.playCount ? "overflow-hidden bg-fill" : "bg-fill opacity-60"}
                  >
                    {bin.playCount && bin.releaseMbId ? (
                      <Image
                        source={{ uri: coverUri(bin.releaseMbId, 250) }}
                        recyclingKey={bin.releaseMbId}
                        cachePolicy="memory-disk"
                        style={{ width: "100%", height: "100%", opacity: 0.45 + 0.55 * (bin.playCount / peak) }}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      ) : null}
      {calendar.isError ? (
        <Pressable
          onPress={() => calendar.refetch()}
          accessibilityRole="button"
          className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1"
        >
          <Text className="text-[11.5px] font-semibold text-white">Listening didn't load · Try again</Text>
        </Pressable>
      ) : (
        <View className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1">
          <Text className="text-[11.5px] font-semibold text-white">last {DAYS} days, by hour</Text>
        </View>
      )}
    </View>
  );
}
