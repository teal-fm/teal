import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@teal/client/utils";
import { AmbientSource, Avatar, Cover, coverUri } from "~/ds";
import { useReducedMotion } from "~/lib/media";

import { DeckCard, type DeckItem } from "./DeckCard";

export type ListeningDeckHandle = { step: (delta: number) => void };

const GAP = 14;

/**
 * A fast, swipeable row of what friends are playing and what groups are into.
 * The focused card's cover feeds the backdrop; a row of faces jumps straight to anyone.
 */
export const ListeningDeck = forwardRef<ListeningDeckHandle, { items: DeckItem[]; wide: boolean }>(function ListeningDeck(
  { items, wide },
  ref,
) {
  const list = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Until measured (and on the server), assume a phone-sized card.
  const cardWidth = wide ? 300 : Math.min(Math.round((width || 360) * 0.78), 330);
  const inset = wide ? 20 : Math.max(16, ((width || 360) - cardWidth) / 2);

  const go = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(items.length - 1, index));
      list.current?.scrollTo({ left: next * (cardWidth + GAP), behavior: reduced ? "auto" : "smooth" });
      setFocused(next);
    },
    [cardWidth, items.length, reduced],
  );
  useImperativeHandle(ref, () => ({ step: (delta) => go(focused + delta) }), [focused, go]);

  const onScroll = () => {
    const node = list.current;
    if (!node) return;
    const index = Math.round(node.scrollLeft / (cardWidth + GAP));
    if (index !== focused) setFocused(Math.max(0, Math.min(items.length - 1, index)));
  };

  const focusedItem = items[focused];
  const focusedCover =
    focusedItem && coverUri(focusedItem.kind === "listen" ? focusedItem.listen.releaseMbId : focusedItem.moment.release.releaseMbId);

  return (
    <div>
      <AmbientSource uri={focusedCover}>
        <div
          ref={list}
          onScroll={onScroll}
          role="list"
          aria-label="What your circle is listening to"
          className="flex snap-x snap-mandatory overflow-x-auto py-2 scrollbar-none"
          style={{ gap: GAP, paddingInline: inset, scrollPaddingInline: inset }}
        >
          {items.map((item, index) => (
            <div
              key={item.key}
              role="listitem"
              className={cn(
                "shrink-0 snap-start transition-[transform,opacity] duration-300 motion-reduce:transition-none",
                index !== focused && "scale-[0.94] opacity-80",
              )}
            >
              <DeckCard item={item} width={cardWidth} />
            </div>
          ))}
        </div>
      </AmbientSource>
      {items.length > 1 ? (
        <div className={cn("flex flex-wrap gap-2.5 px-5 pt-3.5", !wide && "justify-center")} role="group" aria-label="Jump to">
          {items.map((item, index) => {
            const on = index === focused;
            if (item.kind === "listen") {
              const a = item.listen.actor;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(index)}
                  aria-label={`Jump to ${a?.displayName || a?.handle || "listener"}${item.listen.listeningNow ? ", listening now" : ""}`}
                  aria-pressed={on}
                  className={cn("rounded-full transition-[transform,opacity]", on ? "scale-110 ring-2 ring-ink" : "opacity-60 hover:opacity-90")}
                >
                  <Avatar did={a?.did} avatar={a?.avatar} name={a?.displayName ?? a?.handle} size={34} listeningNow={item.listen.listeningNow} />
                </button>
              );
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(index)}
                aria-label={`Jump to ${item.moment.release.releaseName}`}
                aria-pressed={on}
                className={cn("rounded-[9px] transition-[transform,opacity]", on ? "scale-110 ring-2 ring-ink" : "opacity-60 hover:opacity-90")}
              >
                <Cover releaseMbId={item.moment.release.releaseMbId} size={34} radius={8} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
});
