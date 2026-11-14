import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import { displayArtists } from "@teal/client/teal/api";
import { listenHref, musicTrackHref } from "@teal/client/teal/routes";
import { shortAgo } from "@teal/client/teal/today";
import { cn } from "@teal/client/utils";
import { A, Avatar } from "~/ds";

/** Someone's listen in a list of listeners: who, what, and when, linking to the listen itself. */
export function ListenCard({ play, last, showTrack = true }: { play: PlayView; last?: boolean; showTrack?: boolean }) {
  const actor = useDisplayActor(play.author as never, play.authorDid);
  const permalink = listenHref(play.authorDid, play.rkey);
  const artists = displayArtists(play) || "Unknown artist";
  return (
    <div className={cn("flex items-center gap-3 py-2.5", !last && "border-b border-hair")}>
      <A href={actor.href} aria-label={`${actor.name}'s profile`}>
        <Avatar did={actor.did} avatar={actor.avatar} name={actor.name} size={40} />
      </A>
      <div className="flex min-w-0 flex-1 flex-col">
        <A href={actor.href} className="truncate font-semibold text-ink hover:underline">
          {actor.name}
        </A>
        {showTrack ? (
          <A href={musicTrackHref(artists, play.releaseName, play.trackName, play.uri)} className="truncate text-[14px] text-ink-2 hover:underline">
            {play.trackName} · {artists}
          </A>
        ) : null}
      </div>
      {permalink ? (
        <A
          href={permalink}
          aria-label={`Open ${actor.name}'s listen`}
          className="flex min-h-10 items-center text-[13px] tabular-nums text-ink-2 hover:underline"
          suppressHydrationWarning
        >
          {play.playedTime ? shortAgo(play.playedTime) : ""}
        </A>
      ) : null}
    </div>
  );
}
