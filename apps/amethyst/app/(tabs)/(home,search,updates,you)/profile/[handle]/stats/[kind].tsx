import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { loadTop, normalizeKind, normalizePeriod, STATS_PERIODS, withContext, type TopKind } from "@teal/client/teal/topStats";
import { Button, Choices, ErrorNotice, Glass, Loading, Notice, Screen, Tabs } from "@/components/ds";
import { TopRow } from "@/components/profile/TopStats";
import { useActorDid, useActorPlays } from "@teal/client/hooks/useProfile";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const TITLES: Record<TopKind, string> = { artists: "Top artists", albums: "Top albums", tracks: "Top tracks" };

/** Someone's full ranking of artists, albums, or tracks for a period. */
export default function TopStatsScreen() {
  const params = useLocalSearchParams();
  const actor = param(params.handle) ?? "";
  const kind = normalizeKind(param(params.kind));
  const [period, setPeriod] = useState(normalizePeriod(param(params.period)));
  const did = useActorDid(actor).data;
  // Recent history supplies artist names and links for albums and tracks.
  const history = useActorPlays(did);
  const plays = history.data?.pages.flatMap((p) => p.plays) ?? [];
  const top = useInfiniteQuery({
    queryKey: ["top-all", actor, kind, period],
    queryFn: ({ pageParam }) => loadTop(actor, kind, period, 50, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!actor,
  });
  const items = top.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen back title={TITLES[kind]}>
      <Tabs
        label="Ranking"
        value={kind}
        onChange={(next) => router.setParams({ kind: next })}
        tabs={[
          { value: "artists", label: "Artists" },
          { value: "albums", label: "Albums" },
          { value: "tracks", label: "Tracks" },
        ]}
      />
      <Choices label="Period" value={period} onChange={setPeriod} options={STATS_PERIODS} />
      {top.isLoading ? (
        <Loading />
      ) : top.isError ? (
        <ErrorNotice title={`${TITLES[kind]} didn't load`} onRetry={() => top.refetch()} />
      ) : !items.length ? (
        <Notice title="Nothing here yet" body="No listens in this period." />
      ) : (
        <Glass className="px-4 py-1">
          {items.map((item, i) => (
            <TopRow key={`${item.id}-${i}`} item={withContext(item, plays)} rank={i + 1} actor={did ?? actor} last={i === items.length - 1} />
          ))}
        </Glass>
      )}
      {top.hasNextPage ? (
        <Button
          label={top.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={top.isFetchingNextPage}
          onPress={() => top.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}
