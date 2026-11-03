import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import LoadFailure from "@/components/teal/LoadFailure";
import PlayFeedCard from "@/components/teal/PlayFeedCard";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, getAlbum, releaseGroupCoverArtUrl } from "@/lib/teal/api";
import { musicArtistHref, musicTrackHref } from "@/lib/teal/routes";
import { ChevronRight, Disc3, Music2 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { AlbumView } from "@teal/lexicons/src/fm/teal/music/defs";

export default function AlbumDetail() {
  const params = useLocalSearchParams();
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const [album, setAlbum] = useState<AlbumView | null>(null);
  const [plays, setPlays] = useState<PlayView[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [pageError, setPageError] = useState(false);
  const [request, setRequest] = useState(0);
  const requestVersion = useRef(0);
  const [failedArt, setFailedArt] = useState<ReadonlySet<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    requestVersion.current += 1;
    setAlbum(null);
    setPlays([]);
    setCursor(undefined);
    setError(undefined);
    setPageError(false);
    setLoadingMore(false);
    loadingMoreRef.current = false;
    if (!mbid) {
      setError("Missing MusicBrainz release ID");
      return;
    }
    getAlbum(mbid, 30)
      .then((page) => {
        if (!mounted) return;
        setAlbum(page.album);
        setPlays(page.plays);
        setCursor(page.cursor);
        setFailedArt(new Set());
      })
      .catch((loadError) => {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      });
    return () => {
      mounted = false;
      requestVersion.current += 1;
    };
  }, [mbid, request]);

  const loadMore = useCallback(() => {
    if (!mbid || !cursor || loadingMoreRef.current) return;
    const version = requestVersion.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setPageError(false);
    getAlbum(mbid, 30, cursor)
      .then((page) => {
        if (version !== requestVersion.current) return;
        setPlays((current) => {
          const knownUris = new Set(current.map((play) => play.uri));
          return [
            ...current,
            ...page.plays.filter(
              (play) => !play.uri || !knownUris.has(play.uri),
            ),
          ];
        });
        setCursor(page.cursor);
      })
      .catch(() => {
        if (version === requestVersion.current) setPageError(true);
      })
      .finally(() => {
        if (version !== requestVersion.current) return;
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [cursor, mbid]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      if (
        !pageError &&
        contentSize.height - (contentOffset.y + layoutMeasurement.height) < 800
      ) {
        loadMore();
      }
    },
    [loadMore, pageError],
  );

  const artCandidates = [
    releaseGroupCoverArtUrl(album?.releaseGroupMbid, 500),
    coverArtUrl(album?.mbid, 500),
  ].filter((url): url is string => Boolean(url));
  const art = artCandidates.find((url) => !failedArt.has(url));
  const handleArtError = (url: string) => {
    setFailedArt((previous) => new Set(previous).add(url));
  };

  return (
    <TealShell
      rightRail={<RightRail />}
      onScroll={handleScroll}
      pageTitle={album?.name || "Album"}
    >
      <Stack.Screen
        options={{ title: album?.name || "Album", headerShown: false }}
      />
      {!album && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <LoadFailure
          title="This album could not load"
          onRetry={mbid ? () => setRequest((value) => value + 1) : undefined}
        />
      )}
      {album && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-40 bg-muted">
              {art && (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full opacity-40"
                  onError={() => handleArtError(art)}
                />
              )}
            </View>
            <View className="-mt-10 flex-row items-end gap-4 px-5 pb-7">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-muted md:h-28 md:w-28">
                {art ? (
                  <Image
                    source={{ uri: art }}
                    className="h-full w-full"
                    onError={() => handleArtError(art)}
                  />
                ) : (
                  <Icon
                    icon={Disc3}
                    size={42}
                    className="text-muted-foreground"
                  />
                )}
              </View>
              <View className="min-w-0 flex-1 pb-1">
                <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Album
                </Text>
                <Text
                  role="heading"
                  aria-level={1}
                  className="font-sans text-2xl font-black md:text-3xl"
                  numberOfLines={3}
                >
                  {album.name}
                </Text>
                {album.artistMbid ? (
                  <Link
                    href={
                      musicArtistHref(album.artistName, album.artistMbid) as any
                    }
                    asChild
                  >
                    <Pressable>
                      <Text className="font-bold text-muted-foreground">
                        {album.artistName}
                      </Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Text className="font-bold text-muted-foreground">
                    {album.artistName}
                  </Text>
                )}
                <Text className="font-mono text-xs text-muted-foreground">
                  {album.playCount} indexed listens
                </Text>
              </View>
            </View>
          </View>

          <SectionHeading
            eyebrow="Release"
            title="Track list"
            detail={`${album.tracks.length} TRACKS`}
          />
          <View className="mb-10 overflow-hidden rounded-lg border border-border bg-card px-3">
            {album.tracks.map((track) => {
              const row = (
                <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-4">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Icon
                      icon={Music2}
                      size={18}
                      className="text-muted-foreground"
                    />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-black" numberOfLines={2}>
                      {track.name}
                    </Text>
                    <Text
                      className="text-sm text-muted-foreground"
                      numberOfLines={1}
                    >
                      {track.artistName}
                    </Text>
                  </View>
                  <Text className="font-mono text-xs text-muted-foreground">
                    {track.playCount}
                  </Text>
                  {track.uri && (
                    <Icon
                      icon={ChevronRight}
                      size={18}
                      className="text-muted-foreground"
                    />
                  )}
                </Pressable>
              );

              if (!track.uri) {
                return (
                  <View key={track.recordingMbid || track.name}>{row}</View>
                );
              }

              return (
                <Link
                  key={track.uri}
                  href={
                    musicTrackHref(
                      track.artistName,
                      album.name,
                      track.name,
                      track.uri,
                    ) as any
                  }
                  asChild
                >
                  {row}
                </Link>
              );
            })}
          </View>

          <SectionHeading
            eyebrow="Across the network"
            title="Listens"
            detail={`${album.playCount} TOTAL`}
          />
          {plays.map((play, index) => (
            <PlayFeedCard
              key={play.uri || `${play.trackName}-${index}`}
              play={play}
              releaseGroupMbId={album.releaseGroupMbid}
            />
          ))}
          {loadingMore && (
            <View className="items-center justify-center py-5">
              <ActivityIndicator />
            </View>
          )}
          {plays.length > 0 && !cursor && (
            <Text className="pb-6 text-center font-mono text-xs text-muted-foreground">
              You reached the beginning of this album's listening history.
            </Text>
          )}
          {pageError && (
            <View role="alert" className="gap-3 py-4">
              <Text className="text-sm text-muted-foreground">
                Older listens could not load. The album and listens above are
                still available.
              </Text>
              <Button
                variant="outline"
                className="self-start"
                onPress={loadMore}
              >
                <Text>Try again</Text>
              </Button>
            </View>
          )}
        </>
      )}
    </TealShell>
  );
}
