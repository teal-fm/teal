import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import {
  ArtistLeaderboardList,
  ArtistListenerPeriodTabs,
  normalizeArtistListenerPeriod,
} from "@/components/teal/ArtistLeaderboard";
import RightRail from "@/components/teal/RightRail";
import TealShell, {
  SectionHeading,
} from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getArtist,
  getArtistImageUrl,
  getArtistListeners,
  type ArtistListenerPeriod,
} from "@/lib/teal/api";
import { musicAlbumHref, musicArtistListenersHref } from "@/lib/teal/routes";
import { ChevronRight, Disc3, Mic2, Trophy } from "lucide-react-native";

import type { ArtistView } from "@teal/lexicons/src/types/fm/teal/music/defs";
import type { ArtistListenerView } from "@teal/lexicons/src/types/fm/teal/music/defs";

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
  const [listenerError, setListenerError] = useState<string>();
  const [listenersLoading, setListenersLoading] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const [artistImage, setArtistImage] = useState<string>();

  useEffect(() => {
    let mounted = true;
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
  }, [artistLookup, mbid]);

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
  }, [artistLookup, mbid, listenerPeriod]);

  useEffect(() => {
    let mounted = true;
    setArtistImage(undefined);
    if (!artist?.mbid) return;
    getArtistImageUrl(artist.mbid, 500).then((imageUrl) => {
      if (mounted) setArtistImage(imageUrl);
    });
    return () => {
      mounted = false;
    };
  }, [artist?.mbid]);

  const representativeArt = coverArtUrl(artist?.albums[0]?.mbid, 500);
  const heroArt = artistImage || (artFailed ? undefined : representativeArt);
  const handleHeroArtError = () => {
    if (artistImage) {
      setArtistImage(undefined);
    } else {
      setArtFailed(true);
    }
  };

  const renderRelease = (album: ArtistView["albums"][number]) => {
    const art = coverArtUrl(album.mbid);
    return (
      <Link
        key={album.mbid}
        href={
          musicAlbumHref(album.artistName, album.name, album.mbid) as any
        }
        asChild
      >
        <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-4">
          <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {art ? (
              <Image source={{ uri: art }} className="h-full w-full" />
            ) : (
              <Icon
                icon={Disc3}
                size={26}
                className="text-muted-foreground"
              />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-black" numberOfLines={2}>
              {album.name}
            </Text>
            <Text className="font-mono text-xs text-muted-foreground">
              {album.playCount} listens
            </Text>
          </View>
          <Icon
            icon={ChevronRight}
            size={18}
            className="text-muted-foreground"
          />
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
          releases: artist.albums.filter((release) => release.releaseType === "album"),
        },
        {
          title: "EPs",
          releases: artist.albums.filter((release) => release.releaseType === "ep"),
        },
        {
          title: "Singles",
          releases: artist.albums.filter((release) => release.releaseType === "single"),
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
    artist?.albums.filter((release) => release.releaseType === "album").length ?? 0;

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: artist?.name || "Artist", headerShown: false }}
      />
      {!artist && !error && (
        <View className="min-h-[24rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      )}
      {error && (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load artist: {error}
          </Text>
        </View>
      )}
      {artist && (
        <>
          <View className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
            <View className="h-40 bg-muted">
              {heroArt && (
                <Image
                  source={{ uri: heroArt }}
                  className="h-full w-full opacity-40"
                  onError={handleHeroArtError}
                />
              )}
            </View>
            <View className="-mt-10 flex-row items-end gap-4 px-5 pb-7">
              <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-muted md:h-28 md:w-28">
                {heroArt ? (
                  <Image
                    source={{ uri: heroArt }}
                    className="h-full w-full"
                    onError={handleHeroArtError}
                  />
                ) : (
                  <Icon
                    icon={Mic2}
                    size={42}
                    className="text-muted-foreground"
                  />
                )}
              </View>
              <View className="min-w-0 flex-1 pb-1">
                <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Artist
                </Text>
                <Text
                  className="font-sans text-2xl font-black"
                  numberOfLines={3}
                >
                  {artist.name}
                </Text>
                <Text className="font-mono text-xs text-muted-foreground">
                  {artist.playCount} indexed listens
                </Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
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
              <View className="min-h-[8rem] items-center justify-center rounded-lg border border-border bg-card">
                <ActivityIndicator />
              </View>
            ) : listenerError ? (
              <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <Text className="font-bold text-destructive">
                  Could not load listeners: {listenerError}
                </Text>
              </View>
            ) : listeners.length === 0 ? (
              <View className="items-center gap-2 rounded-lg border border-border bg-card p-6">
                <Icon icon={Trophy} size={24} className="text-muted-foreground" />
                <Text className="text-center text-muted-foreground">
                  No indexed listeners for this period yet.
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
          </View>

          <SectionHeading
            eyebrow="Catalog"
            title="Discography"
            detail={`${albumCount} ALBUMS`}
          />
          {discographyGroups.map(({ title, releases }) =>
            releases.length > 0 ? (
              <View key={title} className="mb-6">
                <Text className="mb-2 font-mono text-xs font-bold uppercase text-muted-foreground">
                  {title}
                </Text>
                <View className="overflow-hidden rounded-lg border border-border bg-card px-3">
                  {releases.map(renderRelease)}
                </View>
              </View>
            ) : null,
          )}
        </>
      )}
    </TealShell>
  );
}
