import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Check } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { displayArtists } from "@/lib/teal/api";
import { listenHref, musicTrackHref } from "@/lib/teal/routes";
import { cn } from "@/lib/utils";
import { Cover, Icon, Text } from "@/next/components/ds";

export function listenedAt(value?: string) {
  const time = new Date(value || "");
  if (Number.isNaN(time.getTime())) return undefined;
  return time.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(time.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/**
 * One listen: cover, track, artist, and when. Opens the song page; a listen that
 * is still syncing opens its own page instead, since the index doesn't know it yet.
 * In select mode it toggles instead of navigating.
 */
export function ListenRow({
  play,
  syncing,
  last,
  selecting,
  selected,
  onToggle,
}: {
  play: PlayView;
  syncing?: boolean;
  last?: boolean;
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const artists = displayArtists(play) || "Unknown artist";
  const when = listenedAt(play.playedTime);
  const label = `${play.trackName} by ${artists}${when ? `, listened ${when}` : ""}${syncing ? ", saved and syncing" : ""}`;
  const body = (
    <View className={cn("flex-row items-center gap-3 py-2.5", !last && "border-b border-hair")}>
      {selecting ? (
        <View
          className={cn(
            "h-6 w-6 items-center justify-center rounded-full border-2",
            selected ? "border-tint bg-tint" : "border-hair",
          )}
        >
          {selected ? <Icon icon={Check} size={14} className="text-on-tint" /> : null}
        </View>
      ) : null}
      <Cover releaseMbId={play.releaseMbId} size={48} radius={8} />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {play.trackName}
        </Text>
        <Text className="text-[14px] text-ink-2" numberOfLines={1}>
          {artists}
          {play.releaseName ? ` · ${play.releaseName}` : ""}
        </Text>
        {when || syncing ? (
          <Text className={cn("text-[13px]", syncing ? "font-semibold text-tint" : "text-ink-2")}>
            {syncing ? "Saved, syncing" : when}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (selecting) {
    return (
      <Pressable role="checkbox" aria-checked={!!selected} accessibilityLabel={label} onPress={onToggle}>
        {body}
      </Pressable>
    );
  }
  const href = (syncing && listenHref(play.authorDid, play.rkey)) || musicTrackHref(artists, play.releaseName, play.trackName, play.uri);
  return (
    <Link href={href as never} asChild>
      <Pressable accessibilityLabel={label} className="web:hover:opacity-80">
        {body}
      </Pressable>
    </Link>
  );
}
