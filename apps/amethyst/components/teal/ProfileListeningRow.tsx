import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, displayArtists } from "@/lib/teal/api";
import { listenHref, musicTrackHref } from "@/lib/teal/routes";
import { Music2 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

export default function ProfileListeningRow({
  play,
  syncing = false,
}: {
  play: PlayView;
  syncing?: boolean;
}) {
  const [artFailed, setArtFailed] = useState(false);
  const art = artFailed ? undefined : coverArtUrl(play.releaseMbId, 100);
  const artists = displayArtists(play) || "Unknown artist";
  const time = new Date(play.playedTime || "");
  const date = Number.isNaN(time.getTime())
    ? undefined
    : time.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...(time.getFullYear() !== new Date().getFullYear()
          ? { year: "numeric" }
          : {}),
      });
  return (
    <Link
      href={
        (syncing ? listenHref(play.authorDid, play.rkey) : undefined) ||
        (musicTrackHref(
          artists,
          play.releaseName,
          play.trackName,
          play.uri,
        ) as any)
      }
      asChild
    >
      <Pressable
        accessibilityLabel={`${play.trackName} by ${artists}${date ? `, listened ${date}` : ""}${syncing ? ", saved and syncing" : ""}`}
        className="min-h-20 flex-row items-center gap-3 border-b border-border/70 py-3 web:hover:bg-muted/50"
      >
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-muted">
          {art ? (
            <Image
              source={{ uri: art }}
              className="h-full w-full"
              onError={() => setArtFailed(true)}
            />
          ) : (
            <Icon icon={Music2} size={22} className="text-muted-foreground" />
          )}
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-sans font-bold" numberOfLines={1}>
            {play.trackName}
          </Text>
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {artists}
            {play.releaseName ? ` · ${play.releaseName}` : ""}
          </Text>
          {date && (
            <Text className="text-xs text-muted-foreground">{date}</Text>
          )}
          {syncing && (
            <Text className="text-xs font-semibold text-primary">
              Saved, syncing
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}
