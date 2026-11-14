import { ChevronDown } from "lucide-react";
import { displayActorName } from "@teal/client/teal/actors";
import { parseAtUri } from "@teal/client/teal/routes";
import { cn } from "@teal/client/utils";
import { Avatar, Cover, Glass, Heading, Icon } from "~/ds";

import type { DeckItem } from "./DeckCard";

function cover(item: DeckItem) {
  return item.kind === "listen" ? item.listen.releaseMbId : item.moment.release.releaseMbId;
}

function listener(item: Extract<DeckItem, { kind: "listen" }>) {
  return displayActorName(item.listen.actor, item.listen.actor?.did ?? parseAtUri(item.listen.playUri)?.did);
}

function summary(items: DeckItem[]) {
  const now = items.filter((i) => i.kind === "listen" && i.listen.listeningNow).length;
  const moments = items.filter((i) => i.kind === "moment").length;
  const parts = [];
  if (now) parts.push(`${now} ${now === 1 ? "friend" : "friends"} listening now`);
  if (moments) parts.push(`${moments} group ${moments === 1 ? "moment" : "moments"}`);
  return parts.join(" · ") || "Your circle today";
}

function detail(items: DeckItem[]) {
  return items
    .slice(0, 3)
    .map((i) =>
      i.kind === "listen" ? `${listener(i)} on ${i.listen.artistName ?? i.listen.trackName}` : `${i.moment.listenerCount} on ${i.moment.release.releaseName}`,
    )
    .join(", ");
}

/** Phones: Today folded into one row of covers. Press to open it again. */
export function TodayStrip({ items, onExpand }: { items: DeckItem[]; onExpand: () => void }) {
  return (
    <button type="button" onClick={onExpand} aria-label={`Show Today. ${summary(items)}`} className="block w-full px-4 text-left">
      <Glass className="mb-2 flex items-center gap-3 rounded-[20px] py-2.5 pr-3 pl-2.5">
        <span className="flex">
          {items.slice(0, 4).map((item, i) => (
            <span key={item.key} style={{ marginLeft: i ? -14 : 0 }} className="rounded-[10px] border-2 border-ground">
              <Cover releaseMbId={cover(item)} size={36} radius={8} />
            </span>
          ))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">{summary(items)}</span>
          <span className="truncate text-[13px] text-ink-2">{detail(items)}</span>
        </span>
        <Icon icon={ChevronDown} size={20} className="text-ink-2" />
      </Glass>
    </button>
  );
}

/** Desktop: once seen, Today moves into the rail as a compact grid of covers. */
export function TodayRailGrid({ items, onOpen }: { items: DeckItem[]; onOpen: (index?: number) => void }) {
  return (
    <Glass as="section" className="flex flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <Heading level={2} className="text-[19px]">
          Today
        </Heading>
        <button type="button" onClick={() => onOpen()} className="text-[15px] text-tint hover:underline">
          Expand
        </button>
      </div>
      <p className="-mt-1.5 text-[13.5px] text-ink-2">{summary(items)}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => {
          const listening = item.kind === "listen" && item.listen.listeningNow;
          const label =
            item.kind === "listen"
              ? `${listener(item)}: ${item.listen.trackName}${listening ? ", listening now" : ""}`
              : item.moment.release.releaseName;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpen(index)}
              aria-label={label}
              className={cn("relative rounded-[11px] transition-transform hover:scale-105", listening && "ring-2 ring-now")}
            >
              <Cover releaseMbId={cover(item)} size={54} radius={9} />
              {item.kind === "listen" ? (
                <span className="absolute -right-1 -bottom-1">
                  <Avatar did={item.listen.actor?.did} avatar={item.listen.actor?.avatar} size={20} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Glass>
  );
}
