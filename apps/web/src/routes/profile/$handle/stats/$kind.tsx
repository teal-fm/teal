import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useActorDid, useActorPlays } from "@teal/client/hooks/useProfile";
import { loadTop, normalizeKind, normalizePeriod, STATS_PERIODS, withContext, type TopKind } from "@teal/client/teal/topStats";
import { Button, Choices, ErrorNotice, Glass, Loading, Notice, Screen, Tabs } from "~/ds";
import { TopRow } from "~/components/profile/TopStats";
import { pickStrings } from "~/lib/search";

const TITLES: Record<TopKind, string> = { artists: "Top artists", albums: "Top albums", tracks: "Top tracks" };

export const Route = createFileRoute("/profile/$handle/stats/$kind")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "period"),
  head: ({ params }) => ({ meta: [{ title: `${TITLES[normalizeKind(params.kind)]} · Teal` }] }),
  component: TopStatsScreen,
});

/** Someone's full ranking of artists, albums, or tracks for a period. */
function TopStatsScreen() {
  const { handle: actor, kind: rawKind } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const kind = normalizeKind(rawKind);
  const period = normalizePeriod(search.period);
  const did = useActorDid(actor).data;
  // Recent history supplies artist names and links for albums and tracks.
  const history = useActorPlays(did);
  const plays = history.data?.pages.flatMap((p) => p.plays) ?? [];
  const top = useInfiniteQuery({
    queryKey: ["top-all", actor, kind, period],
    queryFn: ({ pageParam }) => loadTop(actor, kind, period, 50, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
  });
  const items = top.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen back title={TITLES[kind]}>
      <Tabs
        label="Ranking"
        value={kind}
        onChange={(next) => void navigate({ params: { handle: actor, kind: next }, search, replace: true, resetScroll: false })}
        tabs={[
          { value: "artists", label: "Artists" },
          { value: "albums", label: "Albums" },
          { value: "tracks", label: "Tracks" },
        ]}
      />
      <Choices
        label="Period"
        value={period}
        onChange={(next) => void navigate({ search: { period: next }, replace: true, resetScroll: false })}
        options={STATS_PERIODS}
      />
      {top.isLoading ? (
        <Loading />
      ) : top.isError ? (
        <ErrorNotice title={`${TITLES[kind]} didn't load`} onRetry={() => top.refetch()} />
      ) : !items.length ? (
        <Notice title="Nothing here yet" body="No listens in this period." />
      ) : (
        <Glass className="px-4 py-1">
          <ol>
            {items.map((item, i) => (
              <li key={`${item.id}-${i}`}>
                <TopRow item={withContext(item, plays)} rank={i + 1} actor={did ?? actor} last={i === items.length - 1} />
              </li>
            ))}
          </ol>
        </Glass>
      )}
      {top.hasNextPage ? (
        <Button
          label={top.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={top.isFetchingNextPage}
          onClick={() => top.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}
