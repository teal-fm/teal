import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import LoadFailure from "@/components/teal/LoadFailure";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import SocialPostCard from "@/components/teal/SocialPostCard";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getAlbum,
  getPlayByUri,
  getRecordingCoverArtUrl,
  getSearchResults,
  getSocialPost,
  type SocialPostView,
} from "@/lib/teal/api";
import { musicAlbumHref, musicArtistHref, routePart } from "@/lib/teal/routes";
import { appendTrackHistory } from "@/lib/teal/trackHistory";
import { Disc3 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

export default function MusicDetail() {
  const params = useLocalSearchParams();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;
  const postUri = Array.isArray(params.postUri)
    ? params.postUri[0]
    : params.postUri;
  const artistSlug = Array.isArray(params.artist)
    ? params.artist[0]
    : params.artist;
  const releaseSlug = Array.isArray(params.release)
    ? params.release[0]
    : params.release;
  const trackSlug = Array.isArray(params.track)
    ? params.track[0]
    : params.track;
  const [play, setPlay] = useState<PlayView | null>(null);
  const [related, setRelated] = useState<PlayView[]>([]);
  const [sourcePost, setSourcePost] = useState<SocialPostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState(0);
  const [artFailed, setArtFailed] = useState(false);
  const [recordingArt, setRecordingArt] = useState<string>();
  const [historyCursor, setHistoryCursor] = useState<string>();
  const [historyError, setHistoryError] = useState<string>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyBusy = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let mounted = true;
    const version = ++requestVersion.current;
    setPlay(null);
    setError(null);
    setRelated([]);
    setSourcePost(null);
    setHistoryCursor(undefined);
    setHistoryError(undefined);
    setHistoryLoading(false);
    historyBusy.current = false;
    async function resolvePlayFromSlugs() {
      if (!trackSlug) {
        throw new Error("Missing track slug");
      }
      const query = trackSlug.replace(/-/g, " ");
      const results = await getSearchResults(query, 25);
      const match = results.songs.find((song) => {
        const trackMatches = routePart(song.trackName) === trackSlug;
        const releaseMatches =
          !releaseSlug || routePart(song.releaseName) === releaseSlug;
        const artistMatches =
          !artistSlug || routePart(song.artistName) === artistSlug;
        return trackMatches && releaseMatches && artistMatches;
      });

      if (!match) {
        throw new Error("No indexed play matches this music URL");
      }

      return (await getPlayByUri(match.uri)).play;
    }

    async function load() {
      try {
        const selected = uri
          ? (await getPlayByUri(uri)).play
          : await resolvePlayFromSlugs();
        if (!mounted) return;
        setPlay(selected);
        if (postUri)
          getSocialPost(postUri)
            .then((result) => {
              if (mounted) setSourcePost(result.post);
            })
            .catch(() => {});
        if (selected.releaseMbId) {
          historyBusy.current = true;
          setHistoryLoading(true);
          try {
            const albumPage = await getAlbum(selected.releaseMbId, 100);
            if (!mounted) return;
            setRelated(appendTrackHistory([], albumPage.plays, selected));
            setHistoryCursor(albumPage.cursor);
          } catch {
            if (mounted)
              setHistoryError(
                "Could not load this album's listening history. Try again.",
              );
          } finally {
            if (mounted && version === requestVersion.current) {
              historyBusy.current = false;
              setHistoryLoading(false);
            }
          }
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [artistSlug, postUri, releaseSlug, trackSlug, uri, request]);

  async function loadMoreHistory() {
    if (!play?.releaseMbId || historyBusy.current) return;
    const version = requestVersion.current;
    historyBusy.current = true;
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      const page = await getAlbum(play.releaseMbId, 100, historyCursor);
      if (version !== requestVersion.current) return;
      setRelated((current) => appendTrackHistory(current, page.plays, play));
      setHistoryCursor(page.cursor);
    } catch {
      if (version === requestVersion.current)
        setHistoryError(
          "Could not load this album's listening history. Try again.",
        );
    } finally {
      if (version === requestVersion.current) {
        historyBusy.current = false;
        setHistoryLoading(false);
      }
    }
  }

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
    <TealShell rightRail={<RightRail />} pageTitle={play?.trackName || "Track"}>
      <Stack.Screen
        options={{ title: play?.trackName || "Music", headerShown: false }}
      />
      {!play && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <LoadFailure
          title="This track could not load"
          onRetry={() => setRequest((value) => value + 1)}
        />
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
                  role="heading"
                  aria-level={1}
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
          <SectionHeading title="Selected listen" />
          <PlayFeedCard play={play} />
          <SectionHeading title="More listens from this album" />
          <Text className="mb-4 text-sm text-muted-foreground">
            This track's activity on this album, from Teal's listening index.
            Other editions are not included.
          </Text>
          {related.map((item, index) => (
            <PlayFeedCard
              key={item.uri || `${item.trackName}-${index}`}
              play={item}
            />
          ))}
          {historyLoading && (
            <ActivityIndicator
              accessibilityLabel="Loading album listening history"
              className="my-4"
            />
          )}
          {historyError && (
            <Text accessibilityRole="alert" className="my-3 text-destructive">
              {historyError}
            </Text>
          )}
          {!historyLoading && !historyError && related.length === 0 && (
            <Text className="my-3 text-muted-foreground">
              {!play.releaseMbId
                ? "This listen has no album identity, so album history is unavailable."
                : historyCursor
                  ? "No other listens for this track in the loaded album history. Load older activity to keep looking."
                  : "No other listens for this track on this album yet."}
            </Text>
          )}
          {(historyCursor || historyError) && (
            <Button
              variant="outline"
              className="my-4 self-start"
              disabled={historyLoading}
              onPress={loadMoreHistory}
            >
              <Text>
                {historyError ? "Try again" : "Load older album activity"}
              </Text>
            </Button>
          )}
          {sourcePost && (
            <View className="mt-8">
              <SectionHeading eyebrow="Conversation" title="Posts" />
              <SocialPostCard post={sourcePost} />
            </View>
          )}
        </>
      )}
    </TealShell>
  );
}
