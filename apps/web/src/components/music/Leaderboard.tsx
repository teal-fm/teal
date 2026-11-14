import type { ArtistListenerView } from "@teal/lexicons/src/fm/teal/music/defs";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import { countLabel } from "@teal/client/teal/music";
import { cn } from "@teal/client/utils";
import { A, Avatar } from "~/ds";

function ListenerRow({ listener, rank, last }: { listener: ArtistListenerView; rank: number; last: boolean }) {
  const actor = useDisplayActor(listener.actor, listener.actor.did);
  return (
    <li>
      <A
        href={actor.href}
        aria-label={`${rank}. ${actor.name}, ${countLabel(listener.playCount, "listen")}`}
        className={cn("flex items-center gap-3 py-2.5 hover:opacity-80", !last && "border-b border-hair")}
      >
        <span className="w-7 text-center text-[13px] font-semibold tabular-nums text-ink-2">{rank}</span>
        <Avatar did={actor.did} avatar={actor.avatar} name={actor.name} size={40} />
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{actor.name}</span>
        <span className="text-[13px] tabular-nums text-ink-2">{countLabel(listener.playCount, "listen")}</span>
      </A>
    </li>
  );
}

/** Who listens to an artist most, ranked. */
export function Leaderboard({ listeners, offset = 0 }: { listeners: readonly ArtistListenerView[]; offset?: number }) {
  return (
    <ol>
      {listeners.map((listener, i) => (
        <ListenerRow key={listener.actor.did} listener={listener} rank={offset + i + 1} last={i === listeners.length - 1} />
      ))}
    </ol>
  );
}
