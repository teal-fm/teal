import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { displayArtists } from "@teal/client/teal/api";
import { listenHrefFromUri } from "@teal/client/teal/routes";
import { shortAgo } from "@teal/client/teal/today";
import { A, AmbientSource, Cover, coverUri, Glass } from "~/ds";

/** What someone is listening to now, then their last few plays as covers. */
export function NowAndRecent({ now, recent }: { now?: PlayView; recent: PlayView[] }) {
  if (!now && recent.length === 0) return null;
  return (
    // The latest cover tints the profile's backdrop even when nothing is playing now.
    <AmbientSource uri={now ? undefined : coverUri(recent[0]?.releaseMbId)}>
      <Glass className="flex flex-col gap-3 p-4">
        {now ? (
          <AmbientSource uri={coverUri(now.releaseMbId)}>
            <div className="flex items-center gap-3 rounded-[14px] bg-fill p-3">
              <Cover releaseMbId={now.releaseMbId} size={46} radius={7} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[16px] font-semibold text-ink">{now.trackName}</span>
                <span className="truncate text-sm text-ink-2">{displayArtists(now)} · listening now</span>
              </div>
              <span className="size-2 rounded-full bg-now" aria-label="Listening now" role="img" />
            </div>
          </AmbientSource>
        ) : null}
        {recent.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto scrollbar-none" aria-label="Recent listens">
            {recent.map((play) => {
              const href = listenHrefFromUri(play.uri);
              const tile = (
                <>
                  <Cover releaseMbId={play.releaseMbId} size={58} radius={8} label={`${play.trackName}, ${displayArtists(play)}`} />
                  <span className="mt-1 text-[11.5px] tabular-nums text-ink-2" suppressHydrationWarning>
                    {play.playedTime ? shortAgo(play.playedTime) : ""}
                  </span>
                </>
              );
              return (
                <li key={play.uri ?? play.trackName} className="shrink-0">
                  {href ? (
                    <A href={href} className="flex w-[58px] flex-col items-center hover:opacity-85">
                      {tile}
                    </A>
                  ) : (
                    <div className="flex w-[58px] flex-col items-center">{tile}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Glass>
    </AmbientSource>
  );
}
