import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import {
  ArtistLeaderboardList,
  ArtistListenerPeriodTabs,
  normalizeArtistListenerPeriod,
} from "@/components/teal/ArtistLeaderboard";
import { AmbientSource, Glass, useHalo } from "@/components/ds";
import LoadFailure from "@/components/teal/LoadFailure";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getArtist,
  getArtistImageUrl,
  getArtistListeners,
  releaseGroupCoverArtUrl,
  type ArtistListenerPeriod,
} from "@/lib/teal/api";
import { musicAlbumHref, musicArtistListenersHref } from "@/lib/teal/routes";
import { ChevronRight, Disc3, Mic2, Trophy } from "lucide-react-native";

import type {
  ArtistListenerView,
  ArtistView,
} from "@teal/lexicons/src/fm/teal/music/defs";

export default function ArtistDetail() {
  const params = useLocalSearchParams();
  const artistSlug = Array.isArray(params.artist)
    ? params.artist[0]
    : params.artist;
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const artistLookup = name || artistSlug;
  const initialPeriod = Array.isArray(params.period)
    ? params.period[0]
    : params.period;
  const [artist, setArtist] = useState<ArtistView | null>(null);
  const [listeners, setListeners] = useState<ArtistListenerView[]>([]);
  const [listenerPeriod, setListenerPeriod] = useState<ArtistListenerPeriod>(
    normalizeArtistListenerPeriod(initialPeriod),
  );
  const [error, setError] = useState<string>();
  const [request, setRequest] = useState(0);
  const [listenerRequest, setListenerRequest] = useState(0);
  const [listenerError, setListenerError] = useState<string>();
  const [listenersLoading, setListenersLoading] = useState(false);
  const [failedArt, setFailedArt] = useState<ReadonlySet<string>>(new Set());
  const [artistImage, setArtistImage] = useState<string>();
  const halo = useHalo();

  useEffect(() => {
    let mounted = true;
    setArtist(null);
    setError(undefined);
    getArtist(mbid, artistLookup)
      .then(({ artist }) => {
        if (mounted) setArtist(artist);
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
    };
  }, [artistLookup, mbid, request]);

  useEffect(() => {
    let mounted = true;
    setListenersLoading(true);
    setListenerError(undefined);
    getArtistListeners(mbid, artistLookup, listenerPeriod, 5)
      .then(({ listeners }) => {
        if (mounted) setListeners(listeners);
      })
      .catch((loadError) => {
        if (mounted) {
          setListeners([]);
          setListenerError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      })
      .finally(() => {
        if (mounted) setListenersLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [artistLookup, mbid, listenerPeriod, listenerRequest]);

  useEffect(() => {
    let mounted = true;
    setArtistImage(undefined);
    setFailedArt(new Set());
    if (!artist?.mbid) return;
    getArtistImageUrl(artist.mbid, 500).then((imageUrl) => {
      if (mounted) setArtistImage(imageUrl);
    });
    return () => {
      mounted = false;
    };
  }, [artist?.mbid]);

  const handleArtError = (url: string) => {
    setFailedArt((previous) => new Set(previous).add(url));
  };

  const representativeArt = [
    releaseGroupCoverArtUrl(artist?.albums[0]?.releaseGroupMbid, 500),
    coverArtUrl(artist?.albums[0]?.mbid, 500),
  ]
    .filter((url): url is string => Boolean(url))
    .find((url) => !failedArt.has(url));
  const heroArt = artistImage || representativeArt;
  const handleHeroArtError = () => {
    if (artistImage) {
      setArtistImage(undefined);
    } else if (representativeArt) {
      handleArtError(representativeArt);
    }
  };

  const renderRelease = (album: ArtistView["albums"][number]) => {
    const art = [
      releaseGroupCoverArtUrl(album.releaseGroupMbid, 500),
      coverArtUrl(album.mbid, 500),
    ]
      .filter((url): url is string => Boolean(url))
      .find((url) => !failedArt.has(url));
    return (
      <Link
        key={album.mbid}
        href={musicAlbumHref(album.artistName, album.name, album.mbid) as any}
        asChild
      >
        <Pressable className="w-[46%] sm:w-[30%]">
          <AmbientSource uri={art}>
            <View className="aspect-square items-center justify-center overflow-hidden rounded-[14px] bg-fill shadow-lg">
              {art ? (
                <Image
                  source={{ uri: art }}
                  className="h-full w-full"
                  onError={() => art && handleArtError(art)}
                />
              ) : (
                <Icon icon={Disc3} size={30} className="text-ink-3" />
              )}
            </View>
          </AmbientSource>
          <Text className="mt-2 text-[15px] font-semibold text-ink" numberOfLines={2}>
            {album.name}
          </Text>
          <Text className="text-[13px] tabular-nums text-ink-2">
            {album.playCount} {album.playCount === 1 ? "listen" : "listens"}
          </Text>
        </Pressable>
      </Link>
    );
  };

  const discographyGroups: Array<{
    title: string;
    releases: ArtistView["albums"];
  }> = artist
    ? [
        {
          title: "Albums",
          releases: artist.albums.filter(
            (release) => release.releaseType === "album",
          ),
        },
        {
          title: "EPs",
          releases: artist.albums.filter(
            (release) => release.releaseType === "ep",
          ),
        },
        {
          title: "Singles",
          releases: artist.albums.filter(
            (release) => release.releaseType === "single",
          ),
        },
        {
          title: "Other releases",
          releases: artist.albums.filter(
            (release) =>
              release.releaseType !== "album" &&
              release.releaseType !== "ep" &&
              release.releaseType !== "single",
          ),
        },
      ]
    : [];
  const albumCount =
    artist?.albums.filter((release) => release.releaseType === "album")
      .length ?? 0;

  return (
    <TealShell rightRail={<RightRail />} pageTitle={artist?.name || "Artist"}>
      <Stack.Screen
        options={{ title: artist?.name || "Artist", headerShown: false }}
      />
      {!artist && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <LoadFailure
          title="This artist could not load"
          onRetry={() => setRequest((value) => value + 1)}
        />
      )}
      {artist && (
        <>
          <View className="mb-6 gap-5 sm:flex-row sm:items-end">
            <AmbientSource uri={heroArt}>
              <View className="h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-[16px] bg-fill shadow-2xl sm:h-[232px] sm:w-[232px]">
                {heroArt ? (
                  <Image source={{ uri: heroArt }} className="h-full w-full" onError={handleHeroArtError} />
                ) : (
                  <Icon icon={Mic2} size={56} className="text-ink-3" />
                )}
              </View>
            </AmbientSource>
            <View className="min-w-0 flex-1 gap-1">
              <Text
                role="heading"
                aria-level={1}
                style={halo}
                className="text-[40px] font-bold tracking-tight text-ink sm:text-[52px]"
                numberOfLines={3}
              >
                {artist.name}
              </Text>
              <Text style={halo} className="text-[15px] text-ink-2">
                {artist.playCount} {artist.playCount === 1 ? "listen" : "listens"} on teal · {albumCount}{" "}
                {albumCount === 1 ? "album" : "albums"}
              </Text>
            </View>
          </View>

          <Glass className="mb-4 p-4">
            <View className="mb-4 gap-3 md:flex-row md:items-end md:justify-between">
              <SectionHeading
                eyebrow="Community"
                title="Top listeners"
                detail={listenerPeriod === "all" ? "ALL TIME" : listenerPeriod}
              />
              <ArtistListenerPeriodTabs
                period={listenerPeriod}
                onChange={setListenerPeriod}
              />
            </View>
            {listenersLoading && listeners.length === 0 ? (
              <View className="min-h-[8rem] items-center justify-center rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl">
                <ActivityIndicator />
              </View>
            ) : listenerError ? (
              <LoadFailure
                title="Listeners could not load"
                onRetry={() => setListenerRequest((value) => value + 1)}
              />
            ) : listeners.length === 0 ? (
              <View className="items-center gap-2 rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl p-6">
                <Icon
                  icon={Trophy}
                  size={24}
                  className="text-ink-2"
                />
                <Text className="text-center text-ink-2">
                  No listeners for this period yet.
                </Text>
              </View>
            ) : (
              <>
                <ArtistLeaderboardList listeners={listeners} />
                <Link
                  href={
                    musicArtistListenersHref(
                      artist.name,
                      artist.mbid,
                      listenerPeriod,
                    ) as any
                  }
                  asChild
                >
                  <Button variant="outline" className="mt-3 flex-row gap-2">
                    <Icon icon={Trophy} size={16} />
                    <Text>View more listeners</Text>
                  </Button>
                </Link>
              </>
            )}
          </Glass>

          {discographyGroups.map(({ title, releases }) =>
            releases.length > 0 ? (
              <Glass key={title} className="mb-4 gap-3 p-4">
                <Text role="heading" aria-level={2} className="text-[20px] font-bold text-ink">
                  {title}
                </Text>
                <View className="flex-row flex-wrap gap-x-[4%] gap-y-4">{releases.map(renderRelease)}</View>
              </Glass>
            ) : null,
          )}
        </>
      )}
    </TealShell>
  );
}
