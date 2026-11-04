import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ArtistLeaderboardList,
  ArtistListenerPeriodTabs,
  normalizeArtistListenerPeriod,
} from "@/components/teal/ArtistLeaderboard";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import LoadFailure from "@/components/teal/LoadFailure";
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
import { Mic2, Trophy } from "lucide-react-native";

import type {
  ArtistListenerView,
  ArtistView,
} from "@teal/lexicons/src/fm/teal/music/defs";

export default function ArtistListenersScreen() {
  const params = useLocalSearchParams();
  const artistSlug = Array.isArray(params.artist)
    ? params.artist[0]
    : params.artist;
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const artistLookup = name || artistSlug;
  const periodParam = Array.isArray(params.period)
    ? params.period[0]
    : params.period;
  const [artist, setArtist] = useState<ArtistView | null>(null);
  const [listeners, setListeners] = useState<ArtistListenerView[]>([]);
  const [period, setPeriod] = useState<ArtistListenerPeriod>(
    normalizeArtistListenerPeriod(periodParam),
  );
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [artistImage, setArtistImage] = useState<string>();
  const [failedArt, setFailedArt] = useState<ReadonlySet<string>>(new Set());
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    setError(undefined);
    setArtist(null);
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
    setLoading(true);
    setError(undefined);
    setListeners([]);
    setCursor(undefined);
    getArtistListeners(mbid, artistLookup, period, 50)
      .then((page) => {
        if (!mounted) return;
        setListeners(page.listeners);
        setCursor(page.cursor);
      })
      .catch((loadError) => {
        if (mounted) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // `retry` re-runs the fetch after a failure.
  }, [artistLookup, mbid, period, retry]);

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

  const loadMore = useCallback(() => {
    if (!cursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    getArtistListeners(mbid, artistLookup, period, 50, cursor)
      .then((page) => {
        setListeners((current) => {
          const knownDids = new Set(
            current.map((listener) => listener.actor.did).filter(Boolean),
          );
          return [
            ...current,
            ...page.listeners.filter(
              (listener) =>
                !listener.actor.did || !knownDids.has(listener.actor.did),
            ),
          ];
        });
        setCursor(page.cursor);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error ? loadError.message : String(loadError),
        );
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [artistLookup, cursor, mbid, period]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const remaining =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (remaining < 800) loadMore();
    },
    [loadMore],
  );

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
      setFailedArt((previous) => new Set(previous).add(representativeArt));
    }
  };
  const title = artist?.name || name || "Artist";

  return (
    <TealShell
      rightRail={<RightRail />}
      onScroll={handleScroll}
      pageTitle={`${title} listeners`}
    >
      <Stack.Screen
        options={{ title: `${title} listeners`, headerShown: false }}
      />
      <View className="mb-6 overflow-hidden rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl">
        <View className="h-32 bg-muted">
          {heroArt && (
            <Image
              source={{ uri: heroArt }}
              className="h-full w-full opacity-40"
              onError={handleHeroArtError}
            />
          )}
        </View>
        <View className="-mt-10 flex-row items-end gap-4 px-5 pb-6">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {heroArt ? (
              <Image
                source={{ uri: heroArt }}
                className="h-full w-full"
                onError={handleHeroArtError}
              />
            ) : (
              <Icon icon={Mic2} size={34} className="text-ink-2" />
            )}
          </View>
          <View className="min-w-0 flex-1 pb-1">
            <Text className="text-xs font-bold text-ink-2 tabular-nums">
              Artist leaderboard
            </Text>
            <Text className="font-sans text-2xl font-semibold" numberOfLines={2}>
              {title}
            </Text>
            {artist && (
              <Text className="text-xs text-ink-2 tabular-nums">
                {artist.playCount} indexed listens
              </Text>
            )}
          </View>
        </View>
      </View>

      <View className="mb-4 gap-3 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          eyebrow="Community"
          title="Listener leaderboard"
        />
        <ArtistListenerPeriodTabs period={period} onChange={setPeriod} />
      </View>

      {loading ? (
        <View className="min-h-[16rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <LoadFailure
          title="The leaderboard didn't load"
          onRetry={() => setRetry((value) => value + 1)}
        />
      ) : listeners.length === 0 ? (
        <View className="items-center gap-2 rounded-[26px] border border-glass-edge bg-glass-strong web:backdrop-blur-2xl p-8">
          <Icon icon={Trophy} size={28} className="text-ink-2" />
          <Text className="text-center text-ink-2">
            No indexed listeners for this period yet.
          </Text>
        </View>
      ) : (
        <>
          <ArtistLeaderboardList listeners={listeners} />
          {loadingMore && (
            <View className="items-center justify-center py-5">
              <ActivityIndicator />
            </View>
          )}
          {!cursor && (
            <Text className="py-6 text-center text-xs text-ink-2 tabular-nums">
              You reached the end of this artist leaderboard.
            </Text>
          )}
        </>
      )}
    </TealShell>
  );
}
