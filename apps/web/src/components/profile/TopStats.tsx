import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Mic2, Music2 } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { getActorFeed, getArtistImageUrl, getRecordingCoverArtUrl, getSearchResults, type StatsPeriod } from "@teal/client/teal/api";
import { resolveRankedTrack } from "@teal/client/teal/profileRankedTrack";
import { loadTop, periodLabel, playsLabel, STATS_PERIODS, topStatsHref, withContext, type TopItem, type TopKind } from "@teal/client/teal/topStats";
import { cn } from "@teal/client/utils";
import { A, Choices, Cover, ErrorNotice, Glass, Heading, Icon, LinkButton, Spinner, useGo } from "~/ds";

const TITLES: Record<TopKind, string> = { artists: "Top artists", albums: "Top albums", tracks: "Top tracks" };
const FALLBACK_ICON = { artists: Mic2, albums: Disc3, tracks: Music2 } as const;

/** Albums have release art; artists and tracks look theirs up. */
function TopArt({ item, size = 48 }: { item: TopItem; size?: number }) {
  const lookup = useQuery({
    queryKey: ["top-art", item.kind, item.mbid],
    queryFn: async () =>
      (await (item.kind === "artists" ? getArtistImageUrl(item.mbid, 160) : getRecordingCoverArtUrl(item.mbid, 250))) ?? null,
    enabled: item.kind !== "albums" && !!item.mbid,
    // A miss may be a passing MusicBrainz outage, so it's retried later rather than cached for good.
    staleTime: (query) => (query.state.data ? Infinity : 10 * 60_000),
  });
  if (item.kind === "albums") return <Cover releaseMbId={item.mbid} size={size} radius={8} ambient />;
  if (lookup.data) return <Cover uri={lookup.data} size={size} radius={item.kind === "artists" ? size / 2 : 8} ambient={item.kind !== "artists"} />;
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-fill"
      style={{ width: size, height: size, borderRadius: item.kind === "artists" ? size / 2 : 8 }}
    >
      <Icon icon={FALLBACK_ICON[item.kind]} size={size * 0.45} className="text-ink-2" />
    </span>
  );
}

/**
 * One ranked item. Older tracks may not be in recent history, so their page link
 * is found on demand from search and the listener's history.
 */
export function TopRow({ item, rank, actor, last }: { item: TopItem; rank: number; actor: string; last?: boolean }) {
  const go = useGo();
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
      if (result.context?.href) void go(result.context.href);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setFinding(false);
    }
  };

  const body = (
    <>
      <span className="w-7 shrink-0 text-center text-[13px] font-semibold tabular-nums text-ink-2">{rank}</span>
      <TopArt item={item} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{item.name}</span>
        <span className="truncate text-[13px] text-ink-2">
          {notFound ? "Couldn't find this listen" : [item.artist, playsLabel(item.playCount)].filter(Boolean).join(" · ")}
        </span>
      </span>
      {finding ? <Spinner className="size-4" /> : null}
    </>
  );
  const rowClass = cn("flex w-full items-center gap-3 py-2.5 text-left", !last && "border-b border-hair");
  const label = `${rank}. ${item.name}${item.artist ? ` by ${item.artist}` : ""}, ${playsLabel(item.playCount)}`;
  if (item.href) {
    return (
      <A href={item.href} aria-label={label} className={cn(rowClass, "hover:opacity-80")}>
        {body}
      </A>
    );
  }
  if (canFind) {
    return (
      <button type="button" aria-label={label} aria-busy={finding} onClick={find} className={cn(rowClass, "hover:opacity-80")}>
        {body}
      </button>
    );
  }
  return (
    <div aria-label={label} className={rowClass}>
      {body}
    </div>
  );
}

function TopList({ actor, kind, period, plays, limit }: { actor: string; kind: TopKind; period: StatsPeriod; plays: PlayView[]; limit: number }) {
  const top = useQuery({
    queryKey: ["top", actor, kind, period, limit],
    queryFn: () => loadTop(actor, kind, period, limit),
  });
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Heading level={3} size="card">
          {TITLES[kind]}
        </Heading>
        <A
          href={topStatsHref(actor, kind, period)}
          aria-label={`All ${TITLES[kind].toLowerCase()}`}
          className="flex min-h-9 items-center text-[14px] font-semibold text-tint hover:underline"
        >
          See all
        </A>
      </div>
      {top.isLoading ? (
        <div className="flex h-28 items-center justify-center">
          <Spinner />
        </div>
      ) : top.isError ? (
        <ErrorNotice title={`${TITLES[kind]} didn't load`} onRetry={() => top.refetch()} />
      ) : !top.data?.items.length ? (
        <p className="py-3 text-[14px] text-ink-2">No listens in the last {periodLabel(period)}.</p>
      ) : (
        top.data.items.map((item, i) => (
          <TopRow key={item.id} item={withContext(item, plays)} rank={i + 1} actor={actor} last={i === top.data!.items.length - 1} />
        ))
      )}
    </div>
  );
}

/** Someone's top artists, albums, and tracks for a period they can switch. */
export function TopStats({ actor, defaultPeriod, plays }: { actor: string; defaultPeriod: StatsPeriod; plays: PlayView[] }) {
  const [period, setPeriod] = useState(defaultPeriod);
  return (
    <Glass as="section" className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading level={2}>Listening taste</Heading>
        <LinkButton href={`/profile/${encodeURIComponent(actor)}/topster?period=${period}`} label="Album chart" size="sm" variant="secondary" />
      </div>
      <Choices label="Period" value={period} onChange={setPeriod} options={STATS_PERIODS} />
      <div className="flex flex-col gap-5 nav:flex-row nav:gap-6">
        {(["artists", "albums", "tracks"] as const).map((kind) => (
          <TopList key={kind} actor={actor} kind={kind} period={period} plays={plays} limit={5} />
        ))}
      </div>
    </Glass>
  );
}
