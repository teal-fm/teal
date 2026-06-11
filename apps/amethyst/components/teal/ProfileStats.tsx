import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Link } from "expo-router";
import useIsMobile from "@/hooks/useIsMobile";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  getArtistImageUrl,
  getRecordingCoverArtUrl,
  getUserTopArtists,
  getUserTopRecordings,
  getUserTopReleases,
  type StatsPeriod,
} from "@/lib/teal/api";
import { musicAlbumHref, musicArtistHref } from "@/lib/teal/routes";
import { Button } from "../ui/button";
import { Text } from "../ui/text";
import { Disc3, ListMusic, Mic2, Music2 } from "lucide-react-native";

import type {
  ArtistView,
  RecordingView,
  ReleaseView,
} from "@teal/lexicons/src/types/fm/teal/alpha/stats/defs";

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
  return typeof value === "string" && validStatsPeriods.has(value as StatsPeriod)
    ? (value as StatsPeriod)
    : "90days";
}

type StatItem = {
  id: string;
  kind: ProfileStatsKind;
  name: string;
  mbid?: string;
  playCount: number;
};

function mbidId(mbid?: string) {
  return mbid?.replace(/^mbid:/, "");
}

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
          onPress={() => onChange(item.value)}
        >
          <Text>{item.label}</Text>
        </Button>
      ))}
    </View>
  );
}

function StatArtwork({ item, large = false }: { item: StatItem; large?: boolean }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const size = large ? 96 : 72;
  const fallbackIcon =
    item.kind === "artists" ? Mic2 : item.kind === "albums" ? Disc3 : Music2;

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    setImageUrl(undefined);
    if (item.kind === "albums") {
      setImageUrl(coverArtUrl(item.mbid, large ? 250 : 100));
      return;
    }
    if (!item.mbid) return;
    const load =
      item.kind === "artists"
        ? getArtistImageUrl(item.mbid, large ? 320 : 160)
        : getRecordingCoverArtUrl(item.mbid, large ? 250 : 100);
    load.then((url) => {
      if (mounted) setImageUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [item.kind, item.mbid, large]);

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
        <Icon icon={fallbackIcon} size={large ? 36 : 28} className="text-muted-foreground" />
      )}
    </View>
  );
}

function StatPreviewCard({
  item,
  compact,
}: {
  item: StatItem;
  compact: boolean;
}) {
  const href = itemHref(item);
  const content = (
    <Pressable className="h-full rounded-lg border border-border bg-white/65 p-3 web:transition-colors web:hover:border-primary/45">
      <StatArtwork item={item} />
      <Text className="mt-3 font-sans text-base font-black" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
        {playsLabel(item.playCount)}
      </Text>
    </Pressable>
  );
  const width = compact ? "48%" : "23.5%";
  return (
    <View style={{ width }}>
      {href ? (
        <Link href={href as any} asChild>
          {content}
        </Link>
      ) : (
        content
      )}
    </View>
  );
}

function StatListRow({ item, rank }: { item: StatItem; rank: number }) {
  const href = itemHref(item);
  const content = (
    <Pressable className="flex-row items-center gap-3 border-b border-border/70 py-3 web:transition-colors web:hover:bg-primary/5">
      <View className="w-9 items-center">
        <Text className="font-mono text-xs font-bold text-muted-foreground">
          #{rank}
        </Text>
      </View>
      <StatArtwork item={item} large />
      <View className="min-w-0 flex-1">
        <Text className="font-sans text-lg font-black" numberOfLines={2}>
          {item.name}
        </Text>
        {item.mbid && (
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            {mbidId(item.mbid)}
          </Text>
        )}
      </View>
      <View className="min-w-[5.5rem] items-end">
        <Text className="font-sans text-lg font-black">{item.playCount}</Text>
        <Text className="font-mono text-[10px] uppercase text-muted-foreground">
          plays
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
}: {
  actor: string;
  kind: ProfileStatsKind;
  title: string;
  period: StatsPeriod;
}) {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    loadStatsKind(actor, kind, period, 8)
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
  }, [actor, kind, period]);

  return (
    <View className="mb-8">
      <View className="mb-3 flex-row items-center justify-between gap-3">
        <Text className="font-sans text-2xl font-black">{title}</Text>
        <Link href={moreHref(actor, kind, period) as any} asChild>
          <Button size="sm" variant="outline">
            <Text>
              More {kind === "albums" ? "Albums" : kind === "tracks" ? "Tracks" : "Artists"}
            </Text>
          </Button>
        </Link>
      </View>
      {loading ? (
        <View className="h-36 items-center justify-center rounded-lg border border-border bg-white/55">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="rounded-lg border border-border bg-white/55 p-4">
          <Text className="text-muted-foreground">No plays in this period yet.</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {items.map((item) => (
            <StatPreviewCard key={item.id} item={item} compact={isMobile} />
          ))}
        </View>
      )}
    </View>
  );
}

export function ProfileStatsSections({
  actor,
  defaultPeriod,
}: {
  actor: string;
  defaultPeriod?: string;
}) {
  const [period, setPeriod] = useState<StatsPeriod>(
    normalizeStatsPeriod(defaultPeriod),
  );

  useEffect(() => {
    setPeriod(normalizeStatsPeriod(defaultPeriod));
  }, [defaultPeriod]);

  return (
    <View className="mb-2">
      <View className="mb-5 gap-3 rounded-lg border border-border bg-white/55 p-4">
        <View className="flex-row items-center gap-2">
          <Icon icon={ListMusic} size={18} className="text-primary" />
          <Text className="font-mono text-[10px] uppercase text-muted-foreground">
            Listening stats
          </Text>
        </View>
        <StatsPeriodTabs period={period} onChange={setPeriod} />
      </View>
      <StatsPreviewSection actor={actor} kind="artists" title="Top Artists" period={period} />
      <StatsPreviewSection actor={actor} kind="albums" title="Top Albums" period={period} />
      <StatsPreviewSection actor={actor} kind="tracks" title="Top Tracks" period={period} />
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
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title =
    kind === "artists" ? "Top Artists" : kind === "albums" ? "Top Albums" : "Top Tracks";

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(undefined);
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
  }, [actor, kind, period]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    loadStatsKind(actor, kind, period, 50, cursor)
      .then((res) => {
        setItems((current) => [...current, ...res.items]);
        setCursor(res.cursor);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingMore(false));
  }, [actor, cursor, kind, loadingMore, period]);

  return (
    <View>
      <View className="mb-6 gap-3">
        <Text className="font-mono text-[10px] uppercase text-primary">
          Listening stats
        </Text>
        <Text className="font-sans text-4xl font-black">{title}</Text>
        <StatsPeriodTabs period={period} onChange={setPeriod} />
      </View>
      {loading ? (
        <View className="min-h-[18rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="font-bold text-destructive">{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View className="rounded-lg border border-border bg-white/55 p-4">
          <Text className="text-muted-foreground">No plays in this period yet.</Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-lg border border-border bg-card px-3">
          {items.map((item, index) => (
            <StatListRow key={`${item.id}-${index}`} item={item} rank={index + 1} />
          ))}
        </View>
      )}
      {cursor && (
        <View className="items-center py-5">
          <Button
            variant="outline"
            onPress={loadMore}
            disabled={loadingMore}
          >
            <Text>{loadingMore ? "Loading" : "Load more"}</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
