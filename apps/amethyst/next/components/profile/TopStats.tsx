import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Mic2, Music2 } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import {
  getActorFeed,
  getArtistImageUrl,
  getRecordingCoverArtUrl,
  getSearchResults,
  type StatsPeriod,
} from "@/lib/teal/api";
import { resolveRankedTrack } from "@/lib/teal/profileRankedTrack";
import {
  loadTop,
  periodLabel,
  playsLabel,
  STATS_PERIODS,
  topStatsHref,
  withContext,
  type TopItem,
  type TopKind,
} from "@/lib/teal/topStats";
import { Button, Choices, Cover, ErrorNotice, Glass, Heading, Icon, Text } from "@/next/components/ds";

const TITLES: Record<TopKind, string> = { artists: "Top artists", albums: "Top albums", tracks: "Top tracks" };
const FALLBACK_ICON = { artists: Mic2, albums: Disc3, tracks: Music2 } as const;

/** Albums have release art; artists and tracks look theirs up. */
function TopArt({ item, size = 48 }: { item: TopItem; size?: number }) {
  const lookup = useQuery({
    queryKey: ["top-art", item.kind, item.mbid],
    queryFn: () =>
      item.kind === "artists" ? getArtistImageUrl(item.mbid, 160) : getRecordingCoverArtUrl(item.mbid, 250),
    enabled: item.kind !== "albums" && !!item.mbid,
    staleTime: Infinity,
  });
  if (item.kind === "albums") return <Cover releaseMbId={item.mbid} size={size} radius={8} />;
  if (lookup.data) {
    return <Cover uri={lookup.data} size={size} radius={item.kind === "artists" ? size / 2 : 8} />;
  }
  return (
    <View
      className="items-center justify-center bg-fill"
      style={{ width: size, height: size, borderRadius: item.kind === "artists" ? size / 2 : 8 }}
    >
      <Icon icon={FALLBACK_ICON[item.kind]} size={size * 0.45} className="text-ink-2" />
    </View>
  );
}

/**
 * One ranked item. Older tracks may not be in recent history, so their page link
 * is found on demand from search and the listener's history.
 */
export function TopRow({ item, rank, actor, last }: { item: TopItem; rank: number; actor: string; last?: boolean }) {
  const [finding, setFinding] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const canFind = item.kind === "tracks" && !!item.mbid && !item.href;

  const find = async () => {
    if (!canFind || finding) return;
    setFinding(true);
    setNotFound(false);
    try {
      const result = await resolveRankedTrack(actor, item.mbid!, item.name, undefined, {
        search: (query, did) => getSearchResults(query, 25, did),
        history: getActorFeed,
      });
      if (result.context?.href) router.push(result.context.href as never);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setFinding(false);
    }
  };

  const body = (
    <View className={last ? "flex-row items-center gap-3 py-2.5" : "flex-row items-center gap-3 border-b border-hair py-2.5"}>
      <Text className="w-7 text-center text-[13px] font-semibold tabular-nums text-ink-2">{rank}</Text>
      <TopArt item={item} />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-[13px] text-ink-2" numberOfLines={1}>
          {notFound ? "Couldn't find this listen" : [item.artist, playsLabel(item.playCount)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {finding ? <ActivityIndicator size="small" /> : null}
    </View>
  );
  const label = `${rank}. ${item.name}${item.artist ? ` by ${item.artist}` : ""}, ${playsLabel(item.playCount)}`;
  if (item.href) {
    return (
      <Link href={item.href as never} asChild>
        <Pressable accessibilityLabel={label} className="web:hover:opacity-80">
          {body}
        </Pressable>
      </Link>
    );
  }
  if (canFind) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} aria-busy={finding} onPress={find}>
        {body}
      </Pressable>
    );
  }
  return <View accessibilityLabel={label}>{body}</View>;
}

function TopList({
  actor,
  kind,
  period,
  plays,
  limit,
}: {
  actor: string;
  kind: TopKind;
  period: StatsPeriod;
  plays: PlayView[];
  limit: number;
}) {
  const top = useQuery({
    queryKey: ["top", actor, kind, period, limit],
    queryFn: () => loadTop(actor, kind, period, limit),
  });
  return (
    <View className="min-w-0 flex-1">
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Heading level={3} size="card">
          {TITLES[kind]}
        </Heading>
        <Link href={topStatsHref(actor, kind, period) as never} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`All ${TITLES[kind].toLowerCase()}`} className="min-h-9 justify-center">
            <Text className="text-[14px] font-semibold text-tint">See all</Text>
          </Pressable>
        </Link>
      </View>
      {top.isLoading ? (
        <View className="h-28 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : top.isError ? (
        <ErrorNotice title={`${TITLES[kind]} didn't load`} onRetry={() => top.refetch()} />
      ) : !top.data?.items.length ? (
        <Text className="py-3 text-[14px] text-ink-2">No listens in the last {periodLabel(period)}.</Text>
      ) : (
        top.data.items.map((item, i) => (
          <TopRow
            key={item.id}
            item={withContext(item, plays)}
            rank={i + 1}
            actor={actor}
            last={i === top.data!.items.length - 1}
          />
        ))
      )}
    </View>
  );
}

/** Someone's top artists, albums, and tracks for a period they can switch. */
export function TopStats({
  actor,
  defaultPeriod,
  plays,
  wide,
}: {
  actor: string;
  defaultPeriod: StatsPeriod;
  plays: PlayView[];
  wide?: boolean;
}) {
  const [period, setPeriod] = useState(defaultPeriod);
  return (
    <Glass className="gap-4 p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Heading level={2}>Listening taste</Heading>
        <Link href={`/profile/${encodeURIComponent(actor)}/topster?period=${period}` as never} asChild>
          <Button label="Album chart" size="sm" variant="secondary" />
        </Link>
      </View>
      <Choices label="Period" value={period} onChange={setPeriod} options={STATS_PERIODS} />
      <View className={wide ? "flex-row gap-6" : "gap-5"}>
        {(["artists", "albums", "tracks"] as const).map((kind) => (
          <TopList key={kind} actor={actor} kind={kind} period={period} plays={plays} limit={5} />
        ))}
      </View>
    </Glass>
  );
}
