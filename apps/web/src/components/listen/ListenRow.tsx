import { Check } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { displayArtists } from "@teal/client/teal/api";
import { listenHref, musicTrackHref } from "@teal/client/teal/routes";
import { cn } from "@teal/client/utils";
import { A, Cover, Icon } from "~/ds";

export function listenedAt(value?: string) {
  const time = new Date(value || "");
  if (Number.isNaN(time.getTime())) return undefined;
  return time.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(time.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

/**
 * One listen: cover, track, artist, and when. Opens the song page; a listen that
 * is still syncing opens its own page instead, since the index doesn't know it yet.
 * In select mode it's a checkbox instead of a link.
 */
export function ListenRow({
  play,
  syncing,
  last,
  selecting,
  selected,
  onToggle,
}: {
  play: PlayView;
  syncing?: boolean;
  last?: boolean;
  selecting?: boolean;
  selected?: boolean;
  onToggle?: () => void;
}) {
  const artists = displayArtists(play) || "Unknown artist";
  const when = listenedAt(play.playedTime);
  const body = (
    <>
      {selecting ? (
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-tint bg-tint" : "border-hair",
          )}
        >
          {selected ? <Icon icon={Check} size={14} className="text-on-tint" /> : null}
        </span>
      ) : null}
      <Cover releaseMbId={play.releaseMbId} size={48} radius={8} ambient />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{play.trackName}</span>
        <span className="truncate text-[14px] text-ink-2">
          {artists}
          {play.releaseName ? ` · ${play.releaseName}` : ""}
        </span>
        {when || syncing ? (
          <span className={cn("text-[13px]", syncing ? "font-semibold text-tint" : "text-ink-2")} suppressHydrationWarning>
            {syncing ? "Saved, syncing" : when}
          </span>
        ) : null}
      </span>
    </>
  );
  const rowClass = cn("flex w-full items-center gap-3 py-2.5 text-left", !last && "border-b border-hair");

  if (selecting) {
    return (
      <button type="button" role="checkbox" aria-checked={!!selected} onClick={onToggle} className={rowClass}>
        {body}
      </button>
    );
  }
  const href = (syncing && listenHref(play.authorDid, play.rkey)) || musicTrackHref(artists, play.releaseName, play.trackName, play.uri);
  return (
    <A href={href} className={cn(rowClass, "hover:opacity-80")}>
      {body}
    </A>
  );
}
