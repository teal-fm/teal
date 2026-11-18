import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { getPlays, type PlaysWithProfiles } from "~/lib/api";
import { displayName, profilePath, timeAgo } from "~/lib/format";
import type { Play, Profiles } from "~/lib/types";
import { Avatar } from "./Avatar";
import { Empty } from "./Card";
import { Cover } from "./Cover";

function PlayRow({ play, profiles }: { play: Play; profiles?: Profiles }) {
  const profile = profiles?.[play.did];
  const byline = [play.artists.join(", "), play.releaseName]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 py-2">
      <Cover releaseMbId={play.releaseMbId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {play.originUrl ? (
            <a
              href={play.originUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {play.trackName}
            </a>
          ) : (
            play.trackName
          )}
        </p>
        <p className="truncate text-sm text-neutral-600 dark:text-teal-100/60">
          {byline || "Unknown artist"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        {profiles && (
          <Link
            to="/profile/$handle"
            params={{ handle: profilePath(profile, play.did) }}
            className="flex max-w-36 items-center gap-1.5 text-sm hover:underline sm:max-w-48"
          >
            <Avatar profile={profile} size={18} />
            <span className="truncate">{displayName(profile, play.did)}</span>
          </Link>
        )}
        <time
          dateTime={play.playedTime}
          suppressHydrationWarning
          className="text-xs text-neutral-500 dark:text-teal-100/50"
        >
          {timeAgo(play.playedTime)}
        </time>
      </div>
    </li>
  );
}

/** Plays with a "Load more" that pages through the rest; `did` limits them to one person. */
export function PlayList({
  initial,
  did,
  showPeople,
}: {
  initial: PlaysWithProfiles;
  did?: string;
  showPeople?: boolean;
}) {
  const [pages, setPages] = useState([initial]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // The loader hands over a new first page when the route's data changes.
  if (pages[0] !== initial) setPages([initial]);

  const last = pages[pages.length - 1];
  const plays = pages.flatMap((page) => page.plays);
  const profiles = showPeople
    ? Object.assign({}, ...pages.map((page) => page.profiles))
    : undefined;

  async function more() {
    if (!last.cursor) return;
    setLoading(true);
    setError(false);
    try {
      const page = await getPlays({ data: { did, cursor: last.cursor } });
      setPages((current) => [...current, page]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (plays.length === 0) return <Empty>No listens yet.</Empty>;

  return (
    <>
      <ul className="divide-y divide-neutral-400/15">
        {plays.map((play) => (
          <PlayRow key={play.uri} play={play} profiles={profiles} />
        ))}
      </ul>
      {last.cursor && (
        <button
          type="button"
          onClick={more}
          disabled={loading}
          className="mt-3 w-full rounded-full border border-teal-500/30 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-500/10 disabled:opacity-60 dark:text-teal-300"
        >
          {loading
            ? "Loading…"
            : error
              ? "Couldn't load more. Try again"
              : "Load more"}
        </button>
      )}
    </>
  );
}
