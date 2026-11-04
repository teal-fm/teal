import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getArtistListeners } from "@/lib/teal/api";
import { LISTENER_PERIODS, normalizeListenerPeriod } from "@/lib/teal/music";
import { Button, Choices, ErrorNotice, Glass, Loading, Notice, Screen } from "@/next/components/ds";
import { Leaderboard } from "@/next/components/music/Leaderboard";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Everyone who listens to an artist, ranked, for a period. */
export default function ArtistListeners() {
  const params = useLocalSearchParams();
  const mbid = param(params.mbid);
  const name = param(params.name) || param(params.artist);
  const [period, setPeriod] = useState(normalizeListenerPeriod(param(params.period)));
  const listeners = useInfiniteQuery({
    queryKey: ["artist-listeners-all", mbid, name, period],
    queryFn: ({ pageParam }) => getArtistListeners(mbid, name, period, 50, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
  });
  const all = listeners.data?.pages.flatMap((p) => p.listeners) ?? [];
  return (
    <Screen back title={name ? `${name} listeners` : "Listeners"}>
      <Choices label="Period" value={period} onChange={setPeriod} options={LISTENER_PERIODS} />
      {listeners.isLoading ? (
        <Loading />
      ) : listeners.isError ? (
        <ErrorNotice title="The leaderboard didn't load" onRetry={() => listeners.refetch()} />
      ) : !all.length ? (
        <Notice title="No listeners yet" body="Nobody on teal has played this artist in this period." />
      ) : (
        <Glass className="px-4 py-1">
          <Leaderboard listeners={all} />
        </Glass>
      )}
      {listeners.hasNextPage ? (
        <Button
          label={listeners.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={listeners.isFetchingNextPage}
          onPress={() => listeners.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}
