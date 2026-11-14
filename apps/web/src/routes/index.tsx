import { useEffect, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronUp, SquarePen } from "lucide-react";
import type { ListeningView, SocialPostView } from "@teal/client/teal/api";
import { useFeedQuery, useTodayQuery, useViewerDid } from "@teal/client/teal/queries";
import { useTodaySeen } from "@teal/client/todaySeen";
import { AmbientScreen, ErrorNotice, Heading, IconButton, IconLink, LinkButton, Loading, Notice, useDocumentTitle } from "~/ds";
import { TodayRailGrid, TodayStrip } from "~/components/today/Collapsed";
import { deckItems, type DeckItem } from "~/components/today/DeckCard";
import { HeatingRail, HeatingShelf } from "~/components/today/HeatingUp";
import { ListeningDeck, type ListeningDeckHandle } from "~/components/today/ListeningDeck";
import { PostCard } from "~/components/today/PostCard";
import { Weave, weaveWorthy } from "~/components/today/Weave";
import { useEndReached } from "~/hooks/useEndReached";
import { useLayout } from "~/lib/media";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Today · Teal" }] }),
  component: TodayScreen,
});

type Row =
  | { type: "post"; key: string; post: SocialPostView }
  | { type: "weave"; key: string; listen: ListeningView }
  | { type: "shelf"; key: string };

/** Today: what your circle is listening to, then song posts with listening woven in. */
function TodayScreen() {
  useDocumentTitle("Today");
  return (
    <AmbientScreen>
      <Today />
    </AmbientScreen>
  );
}

function Today() {
  const layout = useLayout();
  const viewer = useViewerDid();
  const today = useTodayQuery();
  const feed = useFeedQuery();
  const { collapsed, collapse, expand, markSeen } = useTodaySeen();
  const deck = useRef<ListeningDeckHandle>(null);
  const deckEnd = useRef<HTMLDivElement>(null);

  const items: DeckItem[] = useMemo(
    () => deckItems(today.data?.listening ?? [], today.data?.moments ?? []),
    [today.data],
  );
  const listeningNow = today.data?.listening.filter((l) => l.listeningNow).length ?? 0;
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  // Posts lead; listening notes and the Heating up shelf are woven between them.
  const rows: Row[] = useMemo(() => {
    const weaves = weaveWorthy(today.data?.listening ?? []);
    const heating = today.data?.heatingUp ?? [];
    const out: Row[] = [];
    posts.forEach((post, i) => {
      out.push({ type: "post", key: post.uri, post });
      if ((i === 0 || i === 2 || i === 5) && weaves.length) {
        const listen = weaves.shift()!;
        out.push({ type: "weave", key: `weave-${listen.playUri}`, listen });
      }
      if (i === 1 && !layout.rail && heating.length) out.push({ type: "shelf", key: "shelf" });
    });
    return out;
  }, [posts, today.data, layout.rail]);

  // Scrolling past the deck counts as having seen Today.
  useEffect(() => {
    const node = deckEnd.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) markSeen();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [markSeen]);

  const more = useEndReached(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, !!feed.hasNextPage);

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const openToday = (index?: number) => {
    expand();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (index !== undefined) setTimeout(() => deck.current?.step(index), 50);
  };
  const showDeck = !collapsed && items.length > 0;

  return (
    <div className="flex justify-center">
      <main className="w-full min-w-0 max-w-[700px] pb-[110px] nav:pb-10">
        <div className="pt-3 nav:pt-6">
          <div className="flex items-end justify-between px-5">
            <div className="min-w-0 flex-1">
              <Heading level={1} onBackdrop>
                Today
              </Heading>
              <p className="halo mt-0.5 text-[15px] text-ink-2" suppressHydrationWarning>
                {date}
                {listeningNow ? ` · ${listeningNow} ${listeningNow === 1 ? "friend" : "friends"} listening now` : ""}
              </p>
            </div>
            <div className="flex gap-2 pb-1">
              {layout.sidebar && showDeck && items.length > 1 ? (
                <>
                  <IconButton glass size={36} icon={ChevronLeft} label="Previous" onClick={() => deck.current?.step(-1)} />
                  <IconButton glass size={36} icon={ChevronRight} label="Next" onClick={() => deck.current?.step(1)} />
                </>
              ) : null}
              {showDeck ? <IconButton glass size={36} icon={ChevronUp} label="Hide Today" onClick={collapse} /> : null}
              {viewer ? <IconLink href="/compose" glass tint size={36} icon={SquarePen} label="Post a song" /> : null}
            </div>
          </div>

          <div className="mt-4">
            {today.isLoading ? (
              <Loading className="py-24" />
            ) : today.isError ? (
              <ErrorNotice className="mx-4" title="Today's listening didn't load" onRetry={() => today.refetch()} />
            ) : showDeck ? (
              <ListeningDeck ref={deck} items={items} wide={layout.sidebar} />
            ) : collapsed && !layout.rail && items.length > 0 ? (
              <TodayStrip items={items} onExpand={() => openToday()} />
            ) : items.length === 0 ? (
              <Notice
                className="mx-4"
                title={viewer ? "Quiet in your circle" : "See your circle here"}
                body={
                  viewer
                    ? "Nobody you follow is listening right now. Their listening shows up here as it happens."
                    : "Sign in to see what the people you follow are listening to, right now."
                }
                action={viewer ? null : <LinkButton href="/auth/login" label="Sign in" size="sm" />}
              />
            ) : null}
          </div>
          <div ref={deckEnd} className="h-5" />
        </div>

        <section aria-label="Posts" className="px-2.5 nav:px-5">
          {rows.map((row) =>
            row.type === "post" ? (
              <PostCard key={row.key} post={row.post} />
            ) : row.type === "weave" ? (
              <Weave key={row.key} listen={row.listen} />
            ) : (
              <HeatingShelf key={row.key} moments={today.data?.heatingUp ?? []} />
            ),
          )}
          {rows.length === 0 ? (
            feed.isLoading ? (
              <Loading />
            ) : feed.isError ? (
              <ErrorNotice title="Posts didn't load" onRetry={() => feed.refetch()} />
            ) : (
              <Notice title="No posts yet" body="When people you follow post a song, it shows up here." />
            )
          ) : null}
          <div ref={more} />
          {feed.isFetchingNextPage ? <Loading className="py-6" /> : null}
        </section>
      </main>
      <aside
        aria-label="Your circle"
        className="sticky top-0 hidden max-h-dvh w-[360px] shrink-0 flex-col gap-3.5 overflow-y-auto pt-6 pr-6 pb-10 pl-2 scrollbar-none rail:flex"
      >
        {collapsed && items.length > 0 ? <TodayRailGrid items={items} onOpen={openToday} /> : null}
        <HeatingRail moments={today.data?.heatingUp ?? []} />
      </aside>
    </div>
  );
}
