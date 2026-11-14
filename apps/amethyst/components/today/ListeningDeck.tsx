import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { cn } from "@teal/client/utils";
import { AmbientSource, Avatar, Cover, coverUri } from "@/components/ds";

import { DeckCard, type DeckItem } from "./DeckCard";

export type ListeningDeckHandle = { step: (delta: number) => void };

const GAP = 14;

/**
 * A fast, swipeable row of what friends are playing and what groups are into.
 * The focused card's cover feeds the backdrop; a row of faces jumps straight to anyone.
 */
export const ListeningDeck = forwardRef<
  ListeningDeckHandle,
  { items: DeckItem[]; width: number; wide: boolean }
>(function ListeningDeck({ items, width, wide }, ref) {
  const list = useRef<FlatList<DeckItem>>(null);
  const [focused, setFocused] = useState(0);
  const cardWidth = wide ? 300 : Math.min(Math.round(width * 0.78), 330);
  const inset = wide ? 20 : (width - cardWidth) / 2;

  const go = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(items.length - 1, index));
      list.current?.scrollToOffset({ offset: next * (cardWidth + GAP), animated: true });
      setFocused(next);
    },
    [cardWidth, items.length],
  );
  useImperativeHandle(ref, () => ({ step: (delta) => go(focused + delta) }), [focused, go]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + GAP));
    if (index !== focused) setFocused(Math.max(0, Math.min(items.length - 1, index)));
  };

  const focusedItem = items[focused];
  const focusedCover =
    focusedItem &&
    coverUri(
      focusedItem.kind === "listen"
        ? focusedItem.listen.releaseMbId
        : focusedItem.moment.release.releaseMbId,
    );

  return (
    <View>
      <AmbientSource uri={focusedCover}>
        <FlatList
          ref={list}
          horizontal
          data={items}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={onScroll}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingHorizontal: inset, gap: GAP, paddingVertical: 8 }}
          accessibilityLabel="What your circle is listening to"
          renderItem={({ item, index }) => (
            <View
              className={cn(
                Platform.OS === "web" && "transition-[transform,opacity] duration-300 motion-reduce:transition-none",
                index !== focused && "scale-[0.94] opacity-80",
              )}
            >
              <DeckCard item={item} width={cardWidth} />
            </View>
          )}
        />
      </AmbientSource>
      {items.length > 1 ? (
      <View
        className={cn("flex-row flex-wrap gap-2.5 pt-3.5", wide ? "px-5" : "justify-center px-5")}
        accessibilityLabel="Jump to"
      >
        {items.map((item, index) => {
          const on = index === focused;
          if (item.kind === "listen") {
            const a = item.listen.actor;
            return (
              <Pressable
                key={item.key}
                onPress={() => go(index)}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${a?.displayName || a?.handle || "listener"}${item.listen.listeningNow ? ", listening now" : ""}`}
                accessibilityState={{ selected: on }}
                className={cn("rounded-full", on ? "scale-110 border-2 border-ink" : "opacity-60")}
              >
                <Avatar
                  did={a?.did}
                  avatar={a?.avatar}
                  name={a?.displayName ?? a?.handle}
                  size={on ? 32 : 34}
                  listeningNow={item.listen.listeningNow}
                />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={item.key}
              onPress={() => go(index)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${item.moment.release.releaseName}`}
              accessibilityState={{ selected: on }}
              className={cn("rounded-[9px]", on ? "scale-110 border-2 border-ink" : "opacity-60")}
            >
              <Cover releaseMbId={item.moment.release.releaseMbId} size={on ? 30 : 34} radius={8} />
            </Pressable>
          );
        })}
      </View>
      ) : null}
    </View>
  );
});
