import { Pressable, ScrollView, View } from "react-native";
import { Link } from "expo-router";
import { displayArtists } from "@/lib/teal/api";
import { listenHrefFromUri } from "@/lib/teal/routes";
import { shortAgo } from "@/lib/teal/today";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { AmbientSource, Cover, Glass, Text, coverUri } from "@/components/ds";

/** What someone is listening to now, then their last few plays as covers. */
export function NowAndRecent({ now, recent }: { now?: PlayView; recent: PlayView[] }) {
  if (!now && recent.length === 0) return null;
  return (
    // The latest cover tints the profile's backdrop even when nothing is playing now.
    <AmbientSource uri={now ? undefined : coverUri(recent[0]?.releaseMbId)}>
    <Glass className="gap-3 p-4">
      {now ? (
        <AmbientSource uri={coverUri(now.releaseMbId)}>
          <View className="flex-row items-center gap-3 rounded-[14px] bg-fill p-3">
            <Cover releaseMbId={now.releaseMbId} size={46} radius={7} />
            <View className="min-w-0 flex-1">
              <Text className="text-[16px] font-semibold text-ink" numberOfLines={1}>
                {now.trackName}
              </Text>
              <Text className="text-sm text-ink-2" numberOfLines={1}>
                {displayArtists(now)} · listening now
              </Text>
            </View>
            <View className="h-2 w-2 rounded-full bg-now" accessibilityLabel="Listening now" />
          </View>
        </AmbientSource>
      ) : null}
      {recent.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {recent.map((play) => {
            const href = listenHrefFromUri(play.uri);
            const tile = (
              <View className="w-[58px] items-center">
                <Cover releaseMbId={play.releaseMbId} size={58} radius={8} accessibilityLabel={`${play.trackName}, ${displayArtists(play)}`} />
                <Text className="mt-1 text-[11.5px] tabular-nums text-ink-2">
                  {play.playedTime ? shortAgo(play.playedTime) : ""}
                </Text>
              </View>
            );
            return href ? (
              <Link key={play.uri} href={href as never} asChild>
                <Pressable>{tile}</Pressable>
              </Link>
            ) : (
              <View key={play.uri ?? play.trackName}>{tile}</View>
            );
          })}
        </ScrollView>
      ) : null}
    </Glass>
    </AmbientSource>
  );
}
