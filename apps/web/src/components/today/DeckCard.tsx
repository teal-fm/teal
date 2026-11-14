import { useRef, useState } from "react";
import { Compass, SmilePlus, TrendingUp } from "lucide-react";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import type { ListeningView, MomentView } from "@teal/client/teal/api";
import { useToggleReaction, useViewerDid } from "@teal/client/teal/queries";
import { QUICK_REACTIONS } from "@teal/client/teal/reactions";
import { listenHrefFromUri, musicAlbumHref, parseAtUri } from "@teal/client/teal/routes";
import { listeningFact, momentLabel, momentLine, shortAgo } from "@teal/client/teal/today";
import { cn } from "@teal/client/utils";
import { A, Avatar, Cover, Icon } from "~/ds";

import { ReactionPicker } from "./ReactionPicker";

export type DeckItem =
  | { kind: "listen"; key: string; listen: ListeningView }
  | { kind: "moment"; key: string; moment: MomentView };

function Stickers({ reactions }: { reactions: ListeningView["reactions"] }) {
  return (
    <div className="pointer-events-none absolute right-2.5 bottom-2.5 flex flex-row-reverse" aria-hidden>
      {reactions.slice(0, 4).map((r) => (
        <span
          key={r.emoji}
          className="-ml-3 flex size-11 animate-[sticker_420ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-ground text-[23px] shadow-lg motion-reduce:animate-none"
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
}

function ListeningCard({ listen, width }: { listen: ListeningView; width: number }) {
  const viewer = useViewerDid();
  const toggle = useToggleReaction();
  const [picking, setPicking] = useState(false);
  const lastTap = useRef(0);
  const subject = { uri: listen.playUri, cid: listen.playCid };
  const actor = useDisplayActor(listen.actor, listen.actor?.did ?? parseAtUri(listen.playUri)?.did);
  const fact = listeningFact(listen);
  const listenHref = listenHrefFromUri(listen.playUri);

  const react = (emoji: string) => {
    if (!viewer) return;
    const existing = listen.reactions.find((r) => r.emoji === emoji)?.viewerReaction;
    if (existing === "pending") return;
    toggle.mutate({ subject, emoji, existing });
  };
  // Double-click the cover for 🔥: the fastest way to say "yes, this".
  const onCoverClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      react("🔥");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <div style={{ width }}>
      <div className="relative">
        <div
          onClick={onCoverClick}
          onContextMenu={(event) => {
            if (!viewer) return;
            event.preventDefault();
            setPicking(true);
          }}
          role="img"
          aria-label={`${actor.name} is playing ${listen.trackName}${listen.artistName ? ` by ${listen.artistName}` : ""}`}
        >
          <Cover releaseMbId={listen.releaseMbId} radius={18} style={{ width, height: width }} className="shadow-2xl" eager />
        </div>
        <A
          href={actor.href}
          className="absolute top-2.5 left-2.5 flex h-[34px] max-w-[calc(100%-20px)] items-center gap-2 rounded-full bg-black/45 pr-3 pl-[3px] backdrop-blur-md"
        >
          <Avatar did={actor.did} avatar={actor.avatar} name={actor.name} size={28} />
          <span className="truncate text-[13.5px] font-semibold text-white">{actor.name}</span>
          {listen.listeningNow ? <span className="size-[7px] shrink-0 rounded-full bg-now" aria-label="listening now" /> : null}
          <span className="shrink-0 text-[12.5px] text-white/80" suppressHydrationWarning>
            {listen.listeningNow ? "now" : shortAgo(listen.playedTime)}
          </span>
        </A>
        <Stickers reactions={listen.reactions} />
      </div>
      <div className="mt-3 flex flex-col gap-0.5">
        {listenHref ? (
          <A href={listenHref} className="halo truncate text-[19px] font-bold text-ink hover:underline">
            {listen.trackName}
          </A>
        ) : (
          <p className="halo truncate text-[19px] font-bold text-ink">{listen.trackName}</p>
        )}
        <p className="halo truncate text-[15px] text-ink-2">{[listen.artistName, listen.releaseName].filter(Boolean).join(" · ")}</p>
        {fact ? <p className="halo mt-1.5 line-clamp-2 text-[15px] text-ink-2">{fact}</p> : null}
      </div>
      {viewer ? (
        <div className="mt-2 -ml-1.5 flex">
          {QUICK_REACTIONS.map((emoji) => {
            const mine = listen.reactions.some((r) => r.emoji === emoji && r.viewerReaction);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => react(emoji)}
                aria-label={`React ${emoji}`}
                aria-pressed={mine}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-[22px] transition-transform hover:scale-110 active:scale-75",
                  mine && "bg-fill",
                )}
              >
                {emoji}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label="Any emoji"
            className="flex size-10 items-center justify-center rounded-full hover:bg-fill"
          >
            <Icon icon={SmilePlus} size={21} className="text-ink-2" />
          </button>
          <ReactionPicker visible={picking} onPick={react} onClose={() => setPicking(false)} />
        </div>
      ) : null}
    </div>
  );
}

function MomentCard({ moment, width }: { moment: MomentView; width: number }) {
  const { release } = moment;
  const href =
    release.releaseMbId && release.artistName
      ? musicAlbumHref(release.artistName, release.releaseName, release.releaseMbId)
      : undefined;
  const chip =
    moment.kind === "mutuals" || moment.kind === "circle" ? (
      <div className="flex">
        {moment.listeners.slice(0, 3).map((p, i) => (
          <span key={p.did} style={{ marginLeft: i ? -8 : 0 }}>
            <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={24} />
          </span>
        ))}
      </div>
    ) : (
      <span className="flex size-[26px] items-center justify-center rounded-full bg-tint">
        <Icon icon={moment.kind === "trending" ? TrendingUp : Compass} size={15} className="text-on-tint" />
      </span>
    );

  return (
    <div style={{ width }}>
      <div className="relative">
        <Cover
          releaseMbId={release.releaseMbId}
          radius={18}
          style={{ width, height: width }}
          className="border-2 border-tint/70 shadow-2xl"
          label={`${release.releaseName} cover`}
          eager
        />
        <div className="absolute top-2.5 left-2.5 flex h-[34px] items-center gap-2 rounded-full bg-black/45 pr-3 pl-1 backdrop-blur-md">
          {chip}
          <span className="text-[13.5px] font-semibold text-white">{momentLabel(moment)}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-0.5">
        <p className="halo truncate text-[19px] font-bold text-ink">{release.releaseName}</p>
        {release.artistName ? <p className="halo truncate text-[15px] text-ink-2">{release.artistName}</p> : null}
        <p className="halo mt-1.5 line-clamp-2 text-[15px] text-ink-2">{momentLine(moment)}</p>
      </div>
      {href ? (
        <A href={href} className="mt-3 inline-flex h-9 items-center rounded-full bg-fill px-3.5 text-[14.5px] font-semibold text-ink hover:brightness-95">
          Open the album
        </A>
      ) : null}
    </div>
  );
}

export function DeckCard({ item, width }: { item: DeckItem; width: number }) {
  return item.kind === "listen" ? <ListeningCard listen={item.listen} width={width} /> : <MomentCard moment={item.moment} width={width} />;
}

/** Friends who are listening come first; group moments are slotted in between them. */
export function deckItems(listening: ListeningView[], moments: MomentView[]): DeckItem[] {
  const items: DeckItem[] = listening.map((listen) => ({ kind: "listen", key: listen.playUri, listen }));
  moments.forEach((moment, i) => {
    const at = Math.min(items.length, 1 + i * 3);
    items.splice(at, 0, {
      kind: "moment",
      key: `${moment.kind}-${moment.release.releaseMbId ?? moment.release.releaseName}`,
      moment,
    });
  });
  return items;
}
