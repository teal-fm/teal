import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getArtistListeners } from "@teal/client/teal/api";
import { LISTENER_PERIODS, normalizeListenerPeriod } from "@teal/client/teal/music";
import { Button, Choices, ErrorNotice, Glass, Loading, Notice, Screen } from "~/ds";
import { Leaderboard } from "~/components/music/Leaderboard";
import { pickStrings } from "~/lib/search";

export const Route = createFileRoute("/music/$artist/listeners")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "mbid", "name", "period"),
  head: () => ({ meta: [{ title: "Listeners · Teal" }] }),
  component: ArtistListeners,
});

/** Everyone who listens to an artist, ranked, for a period. */
function ArtistListeners() {
  const { artist: slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const name = search.name || slug;
  const period = normalizeListenerPeriod(search.period);
  const listeners = useInfiniteQuery({
    queryKey: ["artist-listeners-all", search.mbid, name, period],
    queryFn: ({ pageParam }) => getArtistListeners(search.mbid, name, period, 50, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
  });
  const all = listeners.data?.pages.flatMap((p) => p.listeners) ?? [];
  return (
    <Screen back title={search.name ? `${search.name} listeners` : "Listeners"}>
      <Choices
        label="Period"
        value={period}
        onChange={(next) => void navigate({ search: (prev) => ({ ...prev, period: next }), replace: true, resetScroll: false })}
        options={LISTENER_PERIODS}
      />
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
          onClick={() => listeners.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}
