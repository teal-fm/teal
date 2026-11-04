import { Pressable, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { AmbientSource, Avatar, Cover, coverUri, Glass, useHalo } from "@/components/ds";
import { Text } from "@/components/ui/text";
import type { MomentView } from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";

function albumHref(m: MomentView) {
  const r = m.release;
  return r.releaseMbId && r.artistName ? musicAlbumHref(r.artistName, r.releaseName, r.releaseMbId) : undefined;
}

function caption(m: MomentView) {
  const people = `${m.listenerCount} ${m.listenerCount === 1 ? "listener" : "listeners"}`;
  if (m.kind === "trending" && m.changePercent) return `${people} · +${m.changePercent}%`;
  return `${people} today`;
}

function Faces({ moment, size }: { moment: MomentView; size: number }) {
  return (
    <View className="flex-row">
      {moment.listeners.slice(0, 3).map((p, i) => (
        <View key={p.did} style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={size} />
        </View>
      ))}
    </View>
  );
}

/** A horizontal shelf of albums your circle is converging on today (phones). */
export function HeatingShelf({ moments, title = "Heating up" }: { moments: MomentView[]; title?: string }) {
  const halo = useHalo();
  if (moments.length === 0) return null;
  return (
    <View className="mb-5 mt-1">
      <Text style={halo} className="px-2.5 pb-3 text-[22px] font-bold text-ink">
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3.5 px-2.5">
        {moments.map((m) => (
          <Link key={m.release.releaseMbId ?? m.release.releaseName} href={(albumHref(m) ?? "/") as never} asChild>
            <Pressable className="w-[150px]">
              <AmbientSource uri={coverUri(m.release.releaseMbId)}>
                <Cover releaseMbId={m.release.releaseMbId} size={150} radius={14} className="shadow-xl" />
              </AmbientSource>
              <Text style={halo} className="mt-2 text-sm font-semibold text-ink" numberOfLines={1}>
                {m.release.releaseName}
              </Text>
              <Text style={halo} className="text-[13px] text-ink-2" numberOfLines={1}>
                {caption(m)}
              </Text>
              <View className="mt-1.5">
                <Faces moment={m} size={20} />
              </View>
            </Pressable>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

/** The same albums as a compact list for the desktop rail. */
export function HeatingRail({ moments }: { moments: MomentView[] }) {
  if (moments.length === 0) return null;
  return (
    <Glass className="gap-1 p-4">
      <Text className="mb-1 text-[19px] font-bold text-ink">Heating up</Text>
      {moments.map((m) => (
        <Link key={m.release.releaseMbId ?? m.release.releaseName} href={(albumHref(m) ?? "/") as never} asChild>
          <Pressable className="flex-row items-center gap-3 py-1.5">
            <Cover releaseMbId={m.release.releaseMbId} size={52} radius={9} />
            <View className="min-w-0 flex-1">
              <Text className="text-[15px] font-semibold text-ink" numberOfLines={1}>
                {m.release.releaseName}
              </Text>
              <Text className="text-[13.5px] text-ink-2" numberOfLines={1}>
                {m.listenerCount} {m.kind === "circle" ? "friends" : "people"} today
              </Text>
            </View>
          </Pressable>
        </Link>
      ))}
    </Glass>
  );
}
