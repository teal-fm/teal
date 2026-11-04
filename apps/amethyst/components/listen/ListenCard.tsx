import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { displayArtists } from "@/lib/teal/api";
import { listenHref, musicTrackHref } from "@/lib/teal/routes";
import { shortAgo } from "@/lib/teal/today";
import { Avatar, Text } from "@/components/ds";
import { useDisplayActor } from "@/hooks/useDisplayActor";

/** Someone's listen in a list of listeners: who, what, and when, linking to the listen itself. */
export function ListenCard({ play, last, showTrack = true }: { play: PlayView; last?: boolean; showTrack?: boolean }) {
  const actor = useDisplayActor(play.author as never, play.authorDid);
  const permalink = listenHref(play.authorDid, play.rkey);
  const artists = displayArtists(play) || "Unknown artist";
  return (
    <View className={last ? "flex-row items-center gap-3 py-2.5" : "flex-row items-center gap-3 border-b border-hair py-2.5"}>
      <Link href={actor.href as never} asChild>
        <Pressable accessibilityLabel={`${actor.name}'s profile`}>
          <Avatar did={actor.did} avatar={actor.avatar} name={actor.name} size={40} />
        </Pressable>
      </Link>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {actor.name}
        </Text>
        {showTrack ? (
          <Link href={musicTrackHref(artists, play.releaseName, play.trackName, play.uri) as never} asChild>
            <Pressable>
              <Text className="text-[14px] text-ink-2" numberOfLines={1}>
                {play.trackName} · {artists}
              </Text>
            </Pressable>
          </Link>
        ) : null}
      </View>
      {permalink ? (
        <Link href={permalink as never} asChild>
          <Pressable accessibilityLabel={`Open ${actor.name}'s listen`} className="min-h-10 justify-center">
            <Text className="text-[13px] tabular-nums text-ink-2">{play.playedTime ? shortAgo(play.playedTime) : ""}</Text>
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}
