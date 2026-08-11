import { useEffect, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getRecordingCoverArtUrl,
} from "@/lib/teal/api";
import {
  actorAvatarUrl,
  actorProfileHref,
  displayActorName,
  getCachedBlueskyProfile,
  normalizeHandle,
  type DisplayActor,
} from "@/lib/teal/actors";
import { listenHref, musicTrackHref } from "@/lib/teal/routes";
import { cn, timeAgo } from "@/lib/utils";
import { Disc3 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

import { Text } from "../ui/text";

type PlayFeedCardProps = {
  play: PlayView;
  compact?: boolean;
};

export function musicHref(play: PlayView) {
  return musicTrackHref(
    displayArtists(play),
    play.releaseName,
    play.trackName,
    play.uri || "",
  );
}

export default function PlayFeedCard({ play, compact }: PlayFeedCardProps) {
  const [blueskyAuthor, setBlueskyAuthor] = useState<DisplayActor>();
  const [artFailed, setArtFailed] = useState(false);
  const [recordingArt, setRecordingArt] = useState<string>();
  const indexedAuthor = play.author as DisplayActor | undefined;
  const authorProfile = indexedAuthor
    ? {
        ...blueskyAuthor,
        ...indexedAuthor,
        avatar: indexedAuthor.avatar || blueskyAuthor?.avatar,
        displayName: indexedAuthor.displayName || blueskyAuthor?.displayName,
        handle: indexedAuthor.handle || blueskyAuthor?.handle,
      }
    : blueskyAuthor;
  const authorDid = authorProfile?.did || play.authorDid;
  const releaseArt = coverArtUrl(play.releaseMbId);
  const art = artFailed ? undefined : releaseArt || recordingArt;

  useEffect(() => {
    let mounted = true;
    const needsBlueskyFallback =
      !indexedAuthor?.displayName || !indexedAuthor?.handle;
    if (!authorDid || !needsBlueskyFallback) {
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

  useEffect(() => {
    let mounted = true;
    setArtFailed(false);
    if (releaseArt || !play.recordingMbId) {
      setRecordingArt(undefined);
      return;
    }
    getRecordingCoverArtUrl(play.recordingMbId).then((url) => {
      if (mounted) setRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [play.recordingMbId, releaseArt]);

  const authorHandle = normalizeHandle(authorProfile?.handle);
  const authorName = displayActorName(authorProfile, authorDid);
  const authorHref = actorProfileHref(authorProfile, authorDid);
  const authorAvatar = actorAvatarUrl(authorProfile, authorDid);
  const when = play.playedTime
    ? timeAgo(new Date(play.playedTime))
    : "recently";
  const permalink = listenHref(play.authorDid, play.rkey);

  return (
    <View
      className={cn(
        "mb-4 w-full rounded-lg border border-border bg-card/80 p-4 web:transition-colors web:hover:border-primary/45",
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
          <Text className="max-w-full font-semibold" numberOfLines={1}>
            {authorName}
          </Text>
          {authorHandle && (
            <Text
              className="max-w-full font-mono text-xs text-muted-foreground"
              numberOfLines={1}
            >
              @{authorHandle}
            </Text>
          )}
          {permalink ? (
            <Link href={permalink as any} asChild>
              <Pressable>
                <Text className="text-xs font-light text-muted-foreground">
                  listened {when}
                </Text>
              </Pressable>
            </Link>
          ) : (
            <Text className="text-xs font-light text-muted-foreground">
              listened {when}
            </Text>
          )}
        </View>
      </View>

      <View className="mt-4 border-t border-border pt-4">
        <Link href={musicHref(play) as any} asChild>
          <Pressable className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1 pr-1">
              <Text
                className="max-w-full font-sans text-xl font-semibold leading-tight"
                numberOfLines={2}
              >
                {play.trackName}
              </Text>
              <Text
                className="max-w-full text-sm font-bold text-muted-foreground"
                numberOfLines={1}
              >
                {displayArtists(play) || "Unknown artist"}
              </Text>
            </View>
            <View className="shrink-0">
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
        <Text
          className="mt-3 max-w-full text-xs font-light text-primary"
          numberOfLines={2}
        >
          from {play.releaseName}
        </Text>
      )}
    </View>
  );
}
