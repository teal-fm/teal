import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react-native";
import { Avatar, Cover, Glass, Icon, Text } from "@/next/components/ds";

import type { DeckItem } from "./DeckCard";

function cover(item: DeckItem) {
  return item.kind === "listen" ? item.listen.releaseMbId : item.moment.release.releaseMbId;
}

function summary(items: DeckItem[]) {
  const now = items.filter((i) => i.kind === "listen" && i.listen.listeningNow).length;
  const moments = items.filter((i) => i.kind === "moment").length;
  const parts = [];
  if (now) parts.push(`${now} ${now === 1 ? "friend" : "friends"} listening now`);
  if (moments) parts.push(`${moments} group ${moments === 1 ? "moment" : "moments"}`);
  return parts.join(" · ") || "Your circle today";
}

function detail(items: DeckItem[]) {
  return items
    .slice(0, 3)
    .map((i) =>
      i.kind === "listen"
        ? `${i.listen.actor?.displayName || i.listen.actor?.handle || "someone"} on ${i.listen.artistName ?? i.listen.trackName}`
        : `${i.moment.listenerCount} on ${i.moment.release.releaseName}`,
    )
    .join(", ");
}

/** Phones: Today folded into one row of covers. Tap to open it again. */
export function TodayStrip({ items, onExpand }: { items: DeckItem[]; onExpand: () => void }) {
  return (
    <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel={`Show Today. ${summary(items)}`}>
      <Glass className="mx-4 mb-2 flex-row items-center gap-3 rounded-[20px] py-2.5 pl-2.5 pr-3">
        <View className="flex-row">
          {items.slice(0, 4).map((item, i) => (
            <View key={item.key} style={{ marginLeft: i ? -14 : 0 }} className="rounded-[10px] border-2 border-ground">
              <Cover releaseMbId={cover(item)} size={36} radius={8} />
            </View>
          ))}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
            {summary(items)}
          </Text>
          <Text className="text-[13px] text-ink-2" numberOfLines={1}>
            {detail(items)}
          </Text>
        </View>
        <Icon icon={ChevronDown} size={20} className="text-ink-2" />
      </Glass>
    </Pressable>
  );
}

/** Desktop: once seen, Today moves into the rail as a compact grid of covers. */
export function TodayRailGrid({
  items,
  onOpen,
}: {
  items: DeckItem[];
  onOpen: (index?: number) => void;
}) {
  return (
    <Glass className="gap-2.5 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-[19px] font-bold text-ink">Today</Text>
        <Pressable onPress={() => onOpen()} accessibilityRole="button">
          <Text className="text-[15px] text-tint">Expand</Text>
        </Pressable>
      </View>
      <Text className="-mt-1.5 text-[13.5px] text-ink-2">{summary(items)}</Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((item, index) => {
          const listening = item.kind === "listen" && item.listen.listeningNow;
          const label =
            item.kind === "listen"
              ? `${item.listen.actor?.displayName || item.listen.actor?.handle}: ${item.listen.trackName}${listening ? ", listening now" : ""}`
              : `${item.moment.release.releaseName}`;
          return (
            <Pressable
              key={item.key}
              onPress={() => onOpen(index)}
              accessibilityLabel={label}
              className={cn("rounded-[11px] web:hover:scale-105", listening && "border-2 border-now")}
            >
              <Cover releaseMbId={cover(item)} size={listening ? 50 : 54} radius={9} />
              {item.kind === "listen" ? (
                <View className="absolute -bottom-1 -right-1">
                  <Avatar did={item.listen.actor?.did} avatar={item.listen.actor?.avatar} size={20} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}
