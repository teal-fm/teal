import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Link, Stack } from "expo-router";
import Head from "expo-router/head";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientScreen, Glass, useAmbientScroll, useHalo } from "@/components/ds";
import { TodayRailGrid, TodayStrip } from "@/components/today/Collapsed";
import { deckItems, type DeckItem } from "@/components/today/DeckCard";
import { HeatingRail, HeatingShelf } from "@/components/today/HeatingUp";
import { ListeningDeck, type ListeningDeckHandle } from "@/components/today/ListeningDeck";
import { PostCard } from "@/components/today/PostCard";
import { Weave, weaveWorthy } from "@/components/today/Weave";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import type { ListeningView, SocialPostView } from "@/lib/teal/api";
import { useFeedQuery, useTodayQuery, useViewerDid } from "@/lib/teal/queries";
import { useTodaySeen } from "@/lib/todaySeen";
import { ChevronLeft, ChevronRight, ChevronUp, SquarePen } from "lucide-react-native";

const WIDE = 1000;
// The right rail joins at the same width as the shell's other rails.
const RAIL = 1280;

type Row =
  | { type: "post"; key: string; post: SocialPostView }
  | { type: "weave"; key: string; listen: ListeningView }
  | { type: "shelf"; key: string };

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: typeof ChevronUp;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Glass className="h-9 w-9 items-center justify-center rounded-full">
        <Icon icon={icon} size={19} className="text-ink" />
      </Glass>
    </Pressable>
  );
}

function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Glass className="mx-4 my-2 gap-1.5 p-5">
      <Text className="text-[17px] font-semibold text-ink">{title}</Text>
      <Text className="text-[15px] text-ink-2">{body}</Text>
      {action}
    </Glass>
  );
}

export default function TodayScreen() {
  return (
    <AmbientScreen>
      <Stack.Screen options={{ title: "Today" }} />
      <Head>
        <title>Today · Teal</title>
      </Head>
      <Today />
    </AmbientScreen>
  );
}

function Today() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= WIDE;
  const rail = wide && width >= RAIL;
  const insets = useSafeAreaInsets();
  const halo = useHalo();
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
      if (i === 1 && !rail && heating.length) out.push({ type: "shelf", key: "shelf" });
    });
    return out;
  }, [posts, today.data, rail]);

  const contentWidth = wide ? Math.min(660, width - 264 - (rail ? 360 : 40)) : width;
  const date = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

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
    <View style={{ paddingTop: insets.top + (wide ? 24 : 12) }}>
      <View className="flex-row items-end justify-between px-5">
        <View className="min-w-0 flex-1">
          <Text style={halo} role="heading" aria-level={1} className="text-[34px] font-bold text-ink">
            Today
          </Text>
          <Text style={halo} className="mt-0.5 text-[15px] text-ink-2">
            {date}
            {listeningNow ? ` · ${listeningNow} ${listeningNow === 1 ? "friend" : "friends"} listening now` : ""}
          </Text>
        </View>
        <View className="flex-row gap-2 pb-1">
          {wide && showDeck && items.length > 1 ? (
            <>
              <RoundButton icon={ChevronLeft} label="Previous" onPress={() => deck.current?.step(-1)} />
              <RoundButton icon={ChevronRight} label="Next" onPress={() => deck.current?.step(1)} />
            </>
          ) : null}
          {showDeck ? <RoundButton icon={ChevronUp} label="Hide Today" onPress={collapse} /> : null}
          {viewer ? (
            <Link href="/compose" asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Post a song">
                <Glass className="h-9 w-9 items-center justify-center rounded-full">
                  <Icon icon={SquarePen} size={18} className="text-tint" />
                </Glass>
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>

      <View className="mt-4" onLayout={(e) => setDeckBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        {today.isLoading ? (
          <ActivityIndicator className="my-24" />
        ) : today.isError ? (
          <Notice
            title="Couldn't reach teal"
            body="Today's listening didn't load. Check your connection and try again."
            action={
              <Pressable onPress={() => today.refetch()} className="mt-2 self-start rounded-full bg-fill px-4 py-2">
                <Text className="font-semibold text-ink">Try again</Text>
              </Pressable>
            }
          />
        ) : showDeck ? (
          <ListeningDeck ref={deck} items={items} width={contentWidth} wide={wide} />
        ) : collapsed && !rail && items.length > 0 ? (
          <TodayStrip items={items} onExpand={() => openToday()} />
        ) : items.length === 0 ? (
          <Notice
            title={viewer ? "Quiet in your circle" : "See your circle here"}
            body={
              viewer
                ? "Nobody you follow is listening right now. Their listening shows up here as it happens."
                : "Sign in to see what the people you follow are listening to, right now."
            }
            action={
              viewer ? null : (
                <Link href="/auth/login" asChild>
                  <Pressable className="mt-2 self-start rounded-full bg-tint px-4 py-2">
                    <Text className="font-semibold text-on-tint">Sign in</Text>
                  </Pressable>
                </Link>
              )
            }
          />
        ) : null}
      </View>
      <View className="h-5" />
    </View>
  );

  const main = (
    <FlatList
      ref={list}
      data={rows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={header}
      onScroll={onScroll}
      scrollEventThrottle={50}
      onEndReachedThreshold={0.6}
      onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
      contentContainerStyle={{ paddingHorizontal: wide ? 20 : 10, paddingBottom: insets.bottom + 110 }}
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
          <ActivityIndicator className="my-10" />
        ) : feed.isError ? (
          <Notice
            title="Posts didn't load"
            body="We couldn't reach teal for posts."
            action={
              <Pressable onPress={() => feed.refetch()} className="mt-2 self-start rounded-full bg-fill px-4 py-2">
                <Text className="font-semibold text-ink">Try again</Text>
              </Pressable>
            }
          />
        ) : (
          <Notice title="No posts yet" body="When people you follow post a song, it shows up here." />
        )
      }
      ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator className="my-6" /> : null}
    />
  );

  if (!wide) return main;
  if (!rail) {
    return (
      <View className="flex-1 items-center">
        <View style={{ width: contentWidth + 40 }}>{main}</View>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-row justify-center">
      <View style={{ width: contentWidth + 40 }}>{main}</View>
      <ScrollView
        style={{ width: 360, flexGrow: 0 }}
        contentContainerClassName="gap-3.5 pb-10 pl-2 pr-6"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
        accessibilityLabel="Your circle"
      >
        {collapsed && items.length > 0 ? <TodayRailGrid items={items} onOpen={openToday} /> : null}
        <HeatingRail moments={today.data?.heatingUp ?? []} />
      </ScrollView>
    </View>
  );
}
