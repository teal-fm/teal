import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, displayArtists, getBlueskyProfile } from "@/lib/teal/api";
import { musicTrackHref } from "@/lib/teal/routes";
import { cn, timeAgo } from "@/lib/utils";
import { Disc3 } from "lucide-react-native";

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

export function musicHref(play: PlayView) {
  return musicTrackHref(
    displayArtists(play),
    play.releaseName,
    play.trackName,
    play.uri || "",
  );
}

export default function PlayFeedCard({ play, compact }: PlayFeedCardProps) {
  const [blueskyAuthor, setBlueskyAuthor] = useState<FeedAuthor>();
  const [artFailed, setArtFailed] = useState(false);
  const indexedAuthor = play.author as FeedAuthor | undefined;
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

  const art = artFailed ? undefined : coverArtUrl(play.releaseMbId);
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
        "mb-4 w-full rounded-lg border border-border bg-card p-4 web:transition-colors web:hover:border-primary/45",
        compact ? "max-w-[34rem]" : "w-full",
      )}
    >
      <View className="flex-row items-center gap-3">
        <Link href={`/profile/${authorHref}` as any} asChild>
          <Pressable className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary">
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} className="h-full w-full" />
            ) : (
              <Text className="text-lg font-black text-primary-foreground">
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
          <Text className="font-mono text-[10px] text-muted-foreground">
            listened {when}
          </Text>
        </View>
      </View>

      <View className="mt-4 border-t border-border pt-4">
        <Link href={musicHref(play) as any} asChild>
          <Pressable className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="font-sans text-xl font-black" numberOfLines={2}>
                {play.trackName}
              </Text>
              <Text
                className="text-sm font-bold text-muted-foreground"
                numberOfLines={1}
              >
                {displayArtists(play) || "Unknown artist"}
              </Text>
            </View>
            <View>
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-16 w-16 rounded-lg bg-muted"
                  onError={() => setArtFailed(true)}
                />
              ) : (
                <View className="h-16 w-16 items-center justify-center rounded-lg bg-muted">
                  <Icon
                    icon={Disc3}
                    size={26}
                    className="text-muted-foreground"
                  />
                </View>
              )}
            </View>
          </Pressable>
        </Link>
      </View>

      {play.releaseName && (
        <Text className="mt-3 font-mono text-[10px] uppercase text-muted-foreground">
          from {play.releaseName}
        </Text>
      )}
    </View>
  );
}
