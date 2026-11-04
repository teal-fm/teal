import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, ChevronUp, SquarePen } from "lucide-react-native";
import type { ListeningView, SocialPostView } from "@/lib/teal/api";
import { useFeedQuery, useTodayQuery, useViewerDid } from "@/lib/teal/queries";
import { useTodaySeen } from "@/lib/todaySeen";
import {
  AmbientScreen,
  Button,
  ErrorNotice,
  Heading,
  IconButton,
  Loading,
  Notice,
  PageTitle,
  TAB_BAR_CLEARANCE,
  Text,
  useAmbientScroll,
  useLayout,
} from "@/components/ds";
import { TodayRailGrid, TodayStrip } from "@/components/today/Collapsed";
import { deckItems, type DeckItem } from "@/components/today/DeckCard";
import { HeatingRail, HeatingShelf } from "@/components/today/HeatingUp";
import { ListeningDeck, type ListeningDeckHandle } from "@/components/today/ListeningDeck";
import { PostCard } from "@/components/today/PostCard";
import { Weave, weaveWorthy } from "@/components/today/Weave";

type Row =
  | { type: "post"; key: string; post: SocialPostView }
  | { type: "weave"; key: string; listen: ListeningView }
  | { type: "shelf"; key: string };

const SIDEBAR_WIDTH = 264;
const RAIL_WIDTH = 360;

/** Today: what your circle is listening to, then song posts with listening woven in. */
export default function TodayScreen() {
  return (
    <AmbientScreen>
      <PageTitle title="Today" />
      <Today />
    </AmbientScreen>
  );
}

function Today() {
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const viewer = useViewerDid();
  const today = useTodayQuery();
  const feed = useFeedQuery();
  const ambientScroll = useAmbientScroll();
  const { collapsed, collapse, expand, markSeen } = useTodaySeen();
  const deck = useRef<ListeningDeckHandle>(null);
  const list = useRef<FlatList<Row>>(null);
  const [deckBottom, setDeckBottom] = useState(0);

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

  const contentWidth = layout.sidebar
    ? Math.min(660, layout.width - SIDEBAR_WIDTH - (layout.rail ? RAIL_WIDTH : 40))
    : layout.width;
  const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      ambientScroll();
      // Scrolling past the deck counts as having seen Today.
      if (deckBottom && event.nativeEvent.contentOffset.y > deckBottom) markSeen();
    },
    [ambientScroll, deckBottom, markSeen],
  );

  const openToday = (index?: number) => {
    expand();
    list.current?.scrollToOffset({ offset: 0, animated: true });
    if (index !== undefined) setTimeout(() => deck.current?.step(index), 50);
  };

  const showDeck = !collapsed && items.length > 0;
  const header = (
    <View style={{ paddingTop: insets.top + (layout.sidebar ? 24 : 12) }}>
      <View className="flex-row items-end justify-between px-5">
        <View className="min-w-0 flex-1">
          <Heading level={1} onBackdrop>
            Today
          </Heading>
          <Text onBackdrop className="mt-0.5 text-[15px] text-ink-2">
            {date}
            {listeningNow ? ` · ${listeningNow} ${listeningNow === 1 ? "friend" : "friends"} listening now` : ""}
          </Text>
        </View>
        <View className="flex-row gap-2 pb-1">
          {layout.sidebar && showDeck && items.length > 1 ? (
            <>
              <IconButton glass size={36} icon={ChevronLeft} label="Previous" onPress={() => deck.current?.step(-1)} />
              <IconButton glass size={36} icon={ChevronRight} label="Next" onPress={() => deck.current?.step(1)} />
            </>
          ) : null}
          {showDeck ? <IconButton glass size={36} icon={ChevronUp} label="Hide Today" onPress={collapse} /> : null}
          {viewer ? (
            <Link href="/compose" asChild>
              <IconButton glass tint size={36} icon={SquarePen} label="Post a song" />
            </Link>
          ) : null}
        </View>
      </View>

      <View className="mt-4" onLayout={(e) => setDeckBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        {today.isLoading ? (
          <Loading className="py-24" />
        ) : today.isError ? (
          <ErrorNotice className="mx-4" title="Today's listening didn't load" onRetry={() => today.refetch()} />
        ) : showDeck ? (
          <ListeningDeck ref={deck} items={items} width={contentWidth} wide={layout.sidebar} />
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
            action={
              viewer ? null : (
                <Link href="/auth/login" asChild>
                  <Button label="Sign in" size="sm" />
                </Link>
              )
            }
          />
        ) : null}
      </View>
      <View className="h-5" />
    </View>
  );

  const feedList = (
    <FlatList
      ref={list}
      data={rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={header}
      onScroll={onScroll}
      scrollEventThrottle={50}
      onEndReachedThreshold={0.6}
      onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
      contentContainerStyle={{
        paddingHorizontal: layout.sidebar ? 20 : 10,
        paddingBottom: insets.bottom + TAB_BAR_CLEARANCE,
      }}
      renderItem={({ item }) =>
        item.type === "post" ? (
          <PostCard post={item.post} />
        ) : item.type === "weave" ? (
          <Weave listen={item.listen} />
        ) : (
          <HeatingShelf moments={today.data?.heatingUp ?? []} />
        )
      }
      ListEmptyComponent={
        feed.isLoading ? (
          <Loading />
        ) : feed.isError ? (
          <ErrorNotice title="Posts didn't load" onRetry={() => feed.refetch()} />
        ) : (
          <Notice title="No posts yet" body="When people you follow post a song, it shows up here." />
        )
      }
      ListFooterComponent={feed.isFetchingNextPage ? <Loading className="py-6" /> : null}
    />
  );

  if (!layout.sidebar) return feedList;
  return (
    <View className="flex-1 flex-row justify-center">
      <View style={{ width: contentWidth + 40 }}>{feedList}</View>
      {layout.rail ? (
        <ScrollView
          role="complementary"
          accessibilityLabel="Your circle"
          style={{ width: RAIL_WIDTH, flexGrow: 0 }}
          contentContainerClassName="gap-3.5 pb-10 pl-2 pr-6"
          contentContainerStyle={{ paddingTop: insets.top + 24 }}
        >
          {collapsed && items.length > 0 ? <TodayRailGrid items={items} onOpen={openToday} /> : null}
          <HeatingRail moments={today.data?.heatingUp ?? []} />
        </ScrollView>
      ) : null}
    </View>
  );
}
