import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import { Icon } from "@/lib/icons/iconWithClassName";
import { cn, timeAgo } from "@/lib/utils";
import { coverArtUrl, displayArtists } from "@/lib/teal/api";
import { Disc3, Headphones, MoreVertical, Play } from "lucide-react-native";

import { Text } from "../ui/text";

type PlayFeedCardProps = {
  play: PlayView;
  compact?: boolean;
};

function routePart(value?: string) {
  return encodeURIComponent(
    (value || "unknown")
      .toLowerCase()
      .replace(/^mbid:/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "unknown",
  );
}

export function musicHref(play: PlayView) {
  return `/:o/music/${routePart(displayArtists(play))}/${routePart(play.releaseName)}/${routePart(play.trackName)}?uri=${encodeURIComponent(play.uri || "")}`;
}

export default function PlayFeedCard({ play, compact }: PlayFeedCardProps) {
  const art = coverArtUrl(play.releaseMbId);
  const author = play.authorDid || "unknown listener";
  const when = play.playedTime ? timeAgo(new Date(play.playedTime)) : "recently";

  return (
    <View
      className={cn(
        "mb-7 rounded-2xl bg-background/70 p-4 shadow-sm backdrop-blur-xl",
        compact ? "max-w-[34rem]" : "w-full",
      )}
    >
      <View className="flex-row justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row gap-3">
          <Link href={`/profile/${author}` as any} asChild>
            <Pressable className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-primary/60">
              <Icon icon={Headphones} size={30} className="text-primary-foreground" />
            </Pressable>
          </Link>
          <View className="min-w-0 justify-center">
            <Text className="font-black" numberOfLines={1}>
              {author}
            </Text>
            <Text className="text-sm text-muted-foreground">listened {when}</Text>
          </View>
        </View>

        <Link href={musicHref(play) as any} asChild>
          <Pressable className="max-w-[52%] flex-row items-center justify-end gap-3">
            <View className="min-w-0 items-end">
              <Text className="text-right text-lg font-black leading-5" numberOfLines={2}>
                {play.trackName}
              </Text>
              <Text className="text-right text-sm font-bold text-muted-foreground" numberOfLines={1}>
                {displayArtists(play) || "Unknown artist"}
              </Text>
            </View>
            <View className="relative">
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-20 w-20 rounded-xl bg-muted"
                />
              ) : (
                <View className="h-20 w-20 items-center justify-center rounded-xl bg-muted">
                  <Icon icon={Disc3} size={34} className="text-muted-foreground" />
                </View>
              )}
              <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-background">
                <Icon icon={Play} size={18} className="text-foreground" />
              </View>
            </View>
          </Pressable>
        </Link>
      </View>

      <Text className="mt-4 text-lg font-black">
        {play.releaseName ? `from ${play.releaseName}` : "a fresh Teal play"}
      </Text>

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row gap-4 opacity-45">
          <Text className="font-black">♡ 0</Text>
          <Text className="font-black">◼ 0</Text>
        </View>
        <Icon icon={MoreVertical} size={20} className="text-muted-foreground" />
      </View>
    </View>
  );
}
