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
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getArtist,
  getArtistImageUrl,
  getArtistListeners,
  type ArtistListenerPeriod,
} from "@/lib/teal/api";
import { Mic2, Trophy } from "lucide-react-native";

import type {
  ArtistListenerView,
  ArtistView,
} from "@teal/lexicons/src/types/fm/teal/alpha/music/defs";

export default function ArtistListenersScreen() {
  const params = useLocalSearchParams();
  const mbid = Array.isArray(params.mbid) ? params.mbid[0] : params.mbid;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [artistImage, setArtistImage] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    setError(undefined);
    setArtist(null);
    getArtist(mbid, name)
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
  }, [mbid, name]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(undefined);
    setListeners([]);
    setCursor(undefined);
    getArtistListeners(mbid, name, period, 50)
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
  }, [mbid, name, period]);

  useEffect(() => {
    let mounted = true;
    setArtistImage(undefined);
    setArtFailed(false);
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
    getArtistListeners(mbid, name, period, 50, cursor)
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
  }, [cursor, mbid, name, period]);

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

  const representativeArt = coverArtUrl(artist?.albums[0]?.mbid, 500);
  const heroArt = artistImage || (artFailed ? undefined : representativeArt);
  const title = artist?.name || name || "Artist";

  return (
    <TealShell rightRail={<RightRail />} onScroll={handleScroll}>
      <Stack.Screen
        options={{ title: `${title} listeners`, headerShown: false }}
      />
      <View className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
        <View className="h-32 bg-muted">
          {heroArt && (
            <Image
              source={{ uri: heroArt }}
              className="h-full w-full opacity-40"
              onError={() => setArtFailed(true)}
            />
          )}
        </View>
        <View className="-mt-10 flex-row items-end gap-4 px-5 pb-6">
          <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {heroArt ? (
              <Image
                source={{ uri: heroArt }}
                className="h-full w-full"
                onError={() => setArtFailed(true)}
              />
            ) : (
              <Icon icon={Mic2} size={34} className="text-muted-foreground" />
            )}
          </View>
          <View className="min-w-0 flex-1 pb-1">
            <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
              Artist leaderboard
            </Text>
            <Text className="font-sans text-2xl font-black" numberOfLines={2}>
              {title}
            </Text>
            {artist && (
              <Text className="font-mono text-xs text-muted-foreground">
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
          detail={period === "all" ? "ALL TIME" : period}
        />
        <ArtistListenerPeriodTabs period={period} onChange={setPeriod} />
      </View>

      {loading ? (
        <View className="min-h-[16rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load leaderboard: {error}
          </Text>
        </View>
      ) : listeners.length === 0 ? (
        <View className="items-center gap-2 rounded-lg border border-border bg-card p-8">
          <Icon icon={Trophy} size={28} className="text-muted-foreground" />
          <Text className="text-center text-muted-foreground">
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
            <Text className="py-6 text-center font-mono text-xs text-muted-foreground">
              You reached the end of this artist leaderboard.
            </Text>
          )}
        </>
      )}
    </TealShell>
  );
}
