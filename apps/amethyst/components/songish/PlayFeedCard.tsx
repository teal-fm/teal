import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, displayArtists, getBlueskyProfile } from "@/lib/teal/api";
import { cn, timeAgo } from "@/lib/utils";
import { Disc3, MoreVertical, Play } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

import { Text } from "../ui/text";

type PlayFeedCardProps = {
  play: PlayView;
  compact?: boolean;
};

type FeedAuthor = {
  avatar?: string;
  did?: string;
  displayName?: string;
  handle?: string;
};

const blueskyProfileCache = new Map<string, Promise<FeedAuthor | undefined>>();

function getCachedBlueskyProfile(did: string) {
  let profile = blueskyProfileCache.get(did);
  if (!profile) {
    profile = getBlueskyProfile(did)
      .then(({ avatar, displayName, handle }) => ({
        avatar,
        did,
        displayName,
        handle,
      }))
      .catch(() => undefined);
    blueskyProfileCache.set(did, profile);
  }
  return profile;
}

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
  const [blueskyAuthor, setBlueskyAuthor] = useState<FeedAuthor>();
  const indexedAuthor = play.author;
  const authorProfile = indexedAuthor || blueskyAuthor;
  const authorDid = authorProfile?.did || play.authorDid;

  useEffect(() => {
    let mounted = true;
    if (!authorDid || indexedAuthor) {
      setBlueskyAuthor(undefined);
      return;
    }
    getCachedBlueskyProfile(authorDid).then((profile) => {
      if (mounted) setBlueskyAuthor(profile);
    });
    return () => {
      mounted = false;
    };
  }, [authorDid, indexedAuthor]);

  const art = coverArtUrl(play.releaseMbId);
  const authorHandle = authorProfile?.handle?.replace(/^at:\/\//, "");
  const authorName =
    authorProfile?.displayName ||
    authorHandle ||
    authorDid ||
    "Unknown listener";
  const authorHref = authorHandle || authorDid || "unknown";
  const authorAvatar =
    authorDid && indexedAuthor?.avatar
      ? getImageCdnLink({ did: authorDid, hash: indexedAuthor.avatar })
      : authorProfile?.avatar
        ? authorProfile.avatar
        : undefined;
  const when = play.playedTime
    ? timeAgo(new Date(play.playedTime))
    : "recently";

  return (
    <View
      className={cn(
        "mb-7 rounded-2xl bg-background/70 p-4 shadow-sm backdrop-blur-xl",
        compact ? "max-w-[34rem]" : "w-full",
      )}
    >
      <View className="flex-row items-center gap-3">
        <Link href={`/profile/${authorHref}` as any} asChild>
          <Pressable className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary/60">
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} className="h-full w-full" />
            ) : (
              <Text className="text-2xl font-black text-primary-foreground">
                {authorName.slice(0, 1).toUpperCase()}
              </Text>
            )}
          </Pressable>
        </Link>
        <View className="min-w-0 flex-1 justify-center">
          <Text className="font-black" numberOfLines={1}>
            {authorName}
          </Text>
          {authorHandle && (
            <Text
              className="font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              @{authorHandle}
            </Text>
          )}
          <Text className="text-sm text-muted-foreground">listened {when}</Text>
        </View>
      </View>

      <View className="mt-4">
        <Link href={musicHref(play) as any} asChild>
          <Pressable className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-black leading-5" numberOfLines={2}>
                {play.trackName}
              </Text>
              <Text
                className="text-sm font-bold text-muted-foreground"
                numberOfLines={1}
              >
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
                  <Icon
                    icon={Disc3}
                    size={34}
                    className="text-muted-foreground"
                  />
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
