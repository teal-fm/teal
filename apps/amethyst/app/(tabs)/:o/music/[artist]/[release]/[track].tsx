import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getLatestPlays,
  getPlayByUri,
  getRecordingCoverArtUrl,
} from "@/lib/teal/api";
import { musicAlbumHref, musicArtistHref } from "@/lib/teal/routes";
import { Disc3 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

export default function MusicDetail() {
  const params = useLocalSearchParams();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const [play, setPlay] = useState<PlayView | null>(null);
  const [related, setRelated] = useState<PlayView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [recordingArt, setRecordingArt] = useState<string>();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const selected = uri
          ? (await getPlayByUri(uri)).play
          : (await getLatestPlays(1)).plays[0];
        const latest = await getLatestPlays(20);
        if (!mounted) return;
        setPlay(selected);
        setRelated(
          latest.plays.filter((candidate) =>
            selected?.trackName
              ? candidate.trackName === selected.trackName ||
                candidate.releaseMbId === selected.releaseMbId
              : false,
          ),
        );
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [uri]);

  const releaseArt = coverArtUrl(play?.releaseMbId, 500);
  const art = artFailed ? undefined : releaseArt || recordingArt;

  useEffect(() => {
    let mounted = true;
    setArtFailed(false);
    if (releaseArt || !play?.recordingMbId) {
      setRecordingArt(undefined);
      return;
    }
    getRecordingCoverArtUrl(play.recordingMbId, 500).then((url) => {
      if (mounted) setRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [play?.recordingMbId, releaseArt]);

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: play?.trackName || "Music", headerShown: false }}
      />
      {!play && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load music detail: {error}
          </Text>
        </View>
      )}
      {play && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-44 bg-muted">
              {art && (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full opacity-40"
                  onError={() => setArtFailed(true)}
                />
              )}
            </View>
            <View className="-mt-8 flex-row gap-4 px-5 pb-8">
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-24 w-24 rounded-lg bg-muted md:h-28 md:w-28"
                  onError={() => setArtFailed(true)}
                />
              ) : (
                <View className="h-24 w-24 items-center justify-center rounded-lg bg-muted md:h-28 md:w-28">
                  <Icon
                    icon={Disc3}
                    size={42}
                    className="text-muted-foreground"
                  />
                </View>
              )}
              <View className="min-w-0 flex-1 justify-end pb-2">
                <Text
                  className="font-sans text-2xl font-black"
                  numberOfLines={3}
                >
                  {play.trackName}
                </Text>
                {play.artists[0]?.artistMbId ? (
                  <Link
                    href={
                      musicArtistHref(
                        displayArtists(play),
                        play.artists[0].artistMbId,
                      ) as any
                    }
                    asChild
                  >
                    <Pressable>
                      <Text className="font-bold text-muted-foreground">
                        {displayArtists(play) || "Unknown artist"}
                      </Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Text className="font-bold text-muted-foreground">
                    {displayArtists(play) || "Unknown artist"}
                  </Text>
                )}
                {play.releaseName &&
                  (play.releaseMbId ? (
                    <Link
                      href={
                        musicAlbumHref(
                          displayArtists(play),
                          play.releaseName,
                          play.releaseMbId,
                        ) as any
                      }
                      asChild
                    >
                      <Pressable>
                        <Text className="text-muted-foreground">
                          {play.releaseName}
                        </Text>
                      </Pressable>
                    </Link>
                  ) : (
                    <Text className="text-muted-foreground">
                      {play.releaseName}
                    </Text>
                  ))}
              </View>
            </View>
          </View>
          <SectionHeading eyebrow="Listening history" title="Plays" />
          {(related.length ? related : [play]).map((item, index) => (
            <PlayFeedCard
              key={item.uri || `${item.trackName}-${index}`}
              play={item}
            />
          ))}
        </>
      )}
    </TealShell>
  );
}
