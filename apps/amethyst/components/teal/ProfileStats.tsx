import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getActorFeed,
  getArtistImageUrl,
  getRecordingCoverArtUrl,
  getUserTopArtists,
  getUserTopRecordings,
  getUserTopReleases,
  type StatsPeriod,
} from "@/lib/teal/api";
import { indexedStatContext } from "@/lib/teal/profileStats";
import { musicAlbumHref, musicArtistHref } from "@/lib/teal/routes";
import { Disc3, Mic2, Music2 } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type {
  ArtistView,
  RecordingView,
  ReleaseView,
} from "@teal/lexicons/src/fm/teal/stats/defs";

import { Button } from "../ui/button";
import { Text } from "../ui/text";

export type ProfileStatsKind = "artists" | "albums" | "tracks";

export const PROFILE_STATS_PERIODS: Array<{
  label: string;
  value: StatsPeriod;
}> = [
  { label: "7 days", value: "7days" },
  { label: "30 days", value: "30days" },
  { label: "90 days", value: "90days" },
  { label: "180 days", value: "180days" },
  { label: "365 days", value: "365days" },
  { label: "All time", value: "all" },
];

const validStatsPeriods = new Set(PROFILE_STATS_PERIODS.map((p) => p.value));

export function normalizeStatsPeriod(value: unknown): StatsPeriod {
  return typeof value === "string" &&
    validStatsPeriods.has(value as StatsPeriod)
    ? (value as StatsPeriod)
    : "90days";
}

type StatItem = {
  id: string;
  kind: ProfileStatsKind;
  name: string;
  mbid?: string;
  playCount: number;
  artist?: string;
  href?: string;
};

function artistToItem(item: ArtistView, index: number): StatItem {
  return {
    id: item.mbid || `${item.name}-${index}`,
    kind: "artists",
    name: item.name || "Unknown artist",
    mbid: item.mbid,
    playCount: item.playCount || 0,
  };
}

function releaseToItem(item: ReleaseView, index: number): StatItem {
  return {
    id: item.mbid || `${item.name}-${index}`,
    kind: "albums",
    name: item.name || "Unknown album",
    mbid: item.mbid,
    playCount: item.playCount || 0,
  };
}

function recordingToItem(item: RecordingView, index: number): StatItem {
  return {
    id: item.mbid || `${item.name}-${index}`,
    kind: "tracks",
    name: item.name || "Unknown track",
    mbid: item.mbid,
    playCount: item.playCount || 0,
  };
}

function itemHref(item: StatItem) {
  if (item.href) return item.href;
  if (item.kind === "artists") {
    return musicArtistHref(item.name, item.mbid);
  }
  if (item.kind === "albums" && item.mbid) {
    return musicAlbumHref("music", item.name, item.mbid);
  }
  return undefined;
}

function moreHref(actor: string, kind: ProfileStatsKind, period: StatsPeriod) {
  const params = new URLSearchParams({ period });
  return `/profile/${encodeURIComponent(actor)}/stats/${kind}?${params.toString()}`;
}

function playsLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "play" : "plays"}`;
}

function StatsPeriodTabs({
  period,
  onChange,
}: {
  period: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {PROFILE_STATS_PERIODS.map((item) => (
        <Button
          key={item.value}
          size="sm"
          variant={period === item.value ? "default" : "outline"}
          accessibilityState={{ selected: period === item.value }}
          onPress={() => onChange(item.value)}
        >
          <Text>{item.label}</Text>
        </Button>
      ))}
    </View>
  );
}

function StatArtwork({ item }: { item: StatItem }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const size = 48;
  const fallbackIcon =
    item.kind === "artists" ? Mic2 : item.kind === "albums" ? Disc3 : Music2;

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    setImageUrl(undefined);
    if (item.kind === "albums") {
      setImageUrl(coverArtUrl(item.mbid, 100));
      return;
    }
    if (!item.mbid) return;
    const load =
      item.kind === "artists"
        ? getArtistImageUrl(item.mbid, 160)
        : getRecordingCoverArtUrl(item.mbid, 100);
    load.then((url) => {
      if (mounted) setImageUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [item.kind, item.mbid]);

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
      style={{ height: size, width: size }}
    >
      {imageUrl && !failed ? (
        <Image
          source={{ uri: imageUrl }}
          className="h-full w-full"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon icon={fallbackIcon} size={24} className="text-muted-foreground" />
      )}
    </View>
  );
}

function StatListRow({ item, rank }: { item: StatItem; rank: number }) {
  const href = itemHref(item);
  const content = (
    <Pressable
      disabled={!href}
      accessibilityRole={href ? "link" : undefined}
      accessibilityLabel={`${rank}. ${item.name}${item.artist ? ` by ${item.artist}` : ""}, ${playsLabel(item.playCount)}`}
      className="flex-row items-center gap-2 border-b border-border/70 py-3 web:hover:bg-muted/50"
    >
      <Text className="w-5 text-xs text-muted-foreground">{rank}</Text>
      <StatArtwork item={item} />
      <View className="min-w-0 flex-1 gap-1">
        <Text className="font-sans text-sm font-bold" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {item.artist ||
            (item.kind === "artists"
              ? "Artist"
              : item.kind === "albums"
                ? "Album"
                : "Track")}
        </Text>
      </View>
      <View className="items-end pl-1">
        <Text className="text-sm font-bold">
          {item.playCount.toLocaleString()}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {item.playCount === 1 ? "listen" : "listens"}
        </Text>
      </View>
    </Pressable>
  );
  return href ? (
    <Link href={href as any} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

function attachContext(item: StatItem, plays: PlayView[]): StatItem {
  if (item.kind === "artists") return item;
  const context = indexedStatContext(item.kind, item.mbid, plays);
  return context
    ? { ...item, artist: context.artist, href: context.href }
    : item;
}

async function loadStatsKind(
  actor: string,
  kind: ProfileStatsKind,
  period: StatsPeriod,
  limit: number,
  cursor?: string,
) {
  if (kind === "artists") {
    const res = await getUserTopArtists(actor, period, limit, cursor);
    return {
      items: res.artists.map(artistToItem),
      cursor: res.cursor,
    };
  }
  if (kind === "albums") {
    const res = await getUserTopReleases(actor, period, limit, cursor);
    return {
      items: res.releases.map(releaseToItem),
      cursor: res.cursor,
    };
  }
  const res = await getUserTopRecordings(actor, period, limit, cursor);
  return {
    items: res.recordings.map(recordingToItem),
    cursor: res.cursor,
  };
}

function StatsPreviewSection({
  actor,
  kind,
  title,
  period,
  compact = false,
  plays = [],
}: {
  actor: string;
  compact?: boolean;
  plays?: PlayView[];
  kind: ProfileStatsKind;
  title: string;
  period: StatsPeriod;
}) {
  const [items, setItems] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    loadStatsKind(actor, kind, period, compact ? 2 : 5)
      .then((res) => {
        if (mounted) setItems(res.items);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [actor, kind, period, compact]);

  return (
    <View className="mb-5 min-w-0">
      <View className="mb-3 flex-row flex-wrap items-center justify-between gap-3">
        <Text
          accessibilityRole="header"
          aria-level={3}
          className="font-sans text-lg font-bold"
        >
          {title}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {kind === "albums" && !compact && (
            <Link
              href={
                `/profile/${encodeURIComponent(actor)}/topster?period=${period}` as any
              }
              asChild
            >
              <Button size="sm" variant="default">
                <Text>Make chart</Text>
              </Button>
            </Link>
          )}
          <Link href={moreHref(actor, kind, period) as any} asChild>
            <Button size="sm" variant="outline">
              <Text>View all</Text>
            </Button>
          </Link>
        </View>
      </View>
      {loading ? (
        <View className="h-24 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="rounded-lg border border-border bg-card/60 p-4">
          <Text className="text-muted-foreground">
            No listens in this period yet.
          </Text>
        </View>
      ) : (
        <View>
          {items.map((item, index) => (
            <StatListRow
              key={item.id}
              item={attachContext(item, plays)}
              rank={index + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function ProfileStatsSections({
  actor,
  defaultPeriod,
  compact = false,
  plays = [],
}: {
  actor: string;
  defaultPeriod?: string;
  compact?: boolean;
  plays?: PlayView[];
}) {
  const [period, setPeriod] = useState<StatsPeriod>(
    normalizeStatsPeriod(defaultPeriod),
  );
  useEffect(() => {
    setPeriod(normalizeStatsPeriod(defaultPeriod));
  }, [defaultPeriod]);
  return (
    <View className="mb-6">
      <View className="mb-4 gap-3">
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="text-xl font-bold"
        >
          {compact ? "Listening taste" : "Listening stats"}
        </Text>
        <StatsPeriodTabs period={period} onChange={setPeriod} />
        <Text className="text-xs text-muted-foreground">
          Counts use listens received by Teal. Recent saves may take a moment to
          appear. Album charts use the same counts.
        </Text>
      </View>
      <View className={compact ? "gap-4 md:grid md:grid-cols-2" : "gap-2"}>
        <StatsPreviewSection
          actor={actor}
          kind="artists"
          title="Top artists"
          period={period}
          compact={compact}
          plays={plays}
        />
        <StatsPreviewSection
          actor={actor}
          kind="albums"
          title="Top albums"
          period={period}
          compact={compact}
          plays={plays}
        />
        {!compact && (
          <StatsPreviewSection
            actor={actor}
            kind="tracks"
            title="Top tracks"
            period={period}
            plays={plays}
          />
        )}
      </View>
      {compact && (
        <View className="flex-row flex-wrap gap-2">
          <Link href={moreHref(actor, "tracks", period) as any} asChild>
            <Button size="sm" variant="outline">
              <Text>Top tracks</Text>
            </Button>
          </Link>
          <Link
            href={
              `/profile/${encodeURIComponent(actor)}/topster?period=${period}` as any
            }
            asChild
          >
            <Button size="sm" variant="outline">
              <Text>Make album chart</Text>
            </Button>
          </Link>
        </View>
      )}
    </View>
  );
}

export function ProfileStatsMorePage({
  actor,
  kind,
  initialPeriod,
}: {
  actor: string;
  kind: ProfileStatsKind;
  initialPeriod?: string;
}) {
  const [period, setPeriod] = useState<StatsPeriod>(
    normalizeStatsPeriod(initialPeriod),
  );
  const [items, setItems] = useState<StatItem[]>([]);
  const [contextPlays, setContextPlays] = useState<PlayView[]>([]);
  const [retryKey, setRetryKey] = useState(0);
  const requestVersion = useRef(0);
  const router = useRouter();
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title =
    kind === "artists"
      ? "Top Artists"
      : kind === "albums"
        ? "Top Albums"
        : "Top Tracks";

  useEffect(() => {
    let mounted = true;
    requestVersion.current += 1;
    setContextPlays([]);
    setLoadingMore(false);
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(undefined);
    getActorFeed(actor, 50)
      .then((page) => {
        if (mounted) setContextPlays(page.plays);
      })
      .catch(() => undefined);
    loadStatsKind(actor, kind, period, 50)
      .then((res) => {
        if (!mounted) return;
        setItems(res.items);
        setCursor(res.cursor);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [actor, kind, period, retryKey]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const version = requestVersion.current;
    setError(null);
    setLoadingMore(true);
    loadStatsKind(actor, kind, period, 50, cursor)
      .then((res) => {
        if (version !== requestVersion.current) return;
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...res.items.filter((item) => !known.has(item.id)),
          ];
        });
        setCursor(res.cursor);
      })
      .catch(() => {
        if (version === requestVersion.current)
          setError("Could not load more stats. Try again.");
      })
      .finally(() => {
        if (version === requestVersion.current) setLoadingMore(false);
      });
  }, [actor, cursor, kind, loadingMore, period]);

  return (
    <View>
      <View className="mb-6 gap-3">
        <Text
          accessibilityRole="header"
          aria-level={1}
          className="font-sans text-3xl font-bold"
        >
          {title}
        </Text>
        <Text className="text-sm text-muted-foreground">
          Ranked by listens received by Teal. Recent saves may take a moment to
          appear.
        </Text>
        <Link
          href={`/profile/${encodeURIComponent(actor)}?tab=listening` as any}
          asChild
        >
          <Button variant="ghost" className="self-start">
            <Text>Back to listening</Text>
          </Button>
        </Link>
        <StatsPeriodTabs
          period={period}
          onChange={(next) => {
            setPeriod(next);
            router.setParams({ period: next });
          }}
        />
      </View>
      {loading ? (
        <View className="min-h-[18rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error && items.length === 0 ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">
            Could not load listening stats.
          </Text>
          <Button
            variant="outline"
            className="mt-3 self-start"
            onPress={() => setRetryKey((key) => key + 1)}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      ) : items.length === 0 ? (
        <View className="rounded-lg border border-border bg-card/60 p-4">
          <Text className="text-muted-foreground">
            No listens in this period yet.
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-lg border border-border bg-card px-3">
          {items.map((item, index) => (
            <StatListRow
              key={`${item.id}-${index}`}
              item={attachContext(item, contextPlays)}
              rank={index + 1}
            />
          ))}
        </View>
      )}
      {error && items.length > 0 && (
        <Text className="mt-3 text-destructive">{error}</Text>
      )}
      {cursor && (
        <View className="items-center py-5">
          <Button variant="outline" onPress={loadMore} disabled={loadingMore}>
            <Text>{loadingMore ? "Loading" : "Load more"}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
