import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { count, displayName, plural, profilePath } from "~/lib/format";
import type { ArtistStat, Profiles, ReleaseStat, TrackStat } from "~/lib/types";
import { Avatar } from "./Avatar";
import { Empty } from "./Card";
import { Cover } from "./Cover";

function Row({
  rank,
  children,
  plays,
  detail,
}: {
  rank: number;
  children: ReactNode;
  plays: number;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <span className="w-5 shrink-0 text-right text-sm tabular-nums text-neutral-500 dark:text-teal-100/40">
        {rank}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
      <span className="shrink-0 text-right text-sm tabular-nums" title={detail}>
        {count(plays)}
      </span>
    </li>
  );
}

function List({ children, empty }: { children: ReactNode[]; empty: string }) {
  return children.length ? (
    <ol className="flex flex-col">{children}</ol>
  ) : (
    <Empty>{empty}</Empty>
  );
}

export function ListenerRanking({
  listeners,
  profiles,
}: {
  listeners: { did: string; plays: number }[];
  profiles: Profiles;
}) {
  return (
    <List empty="Nobody's listened yet.">
      {listeners.map(({ did, plays }, i) => {
        const profile = profiles[did];

        return (
          <Row
            key={did}
            rank={i + 1}
            plays={plays}
            detail={plural(plays, "listen")}
          >
            <Link
              to="/profile/$handle"
              params={{ handle: profilePath(profile, did) }}
              className="flex min-w-0 items-center gap-2.5 hover:underline"
            >
              <Avatar profile={profile} size={28} />
              <span className="truncate font-medium">
                {displayName(profile, did)}
              </span>
            </Link>
          </Row>
        );
      })}
    </List>
  );
}

export function ArtistRanking({ artists }: { artists: ArtistStat[] }) {
  return (
    <List empty="No artists yet.">
      {artists.map((artist, i) => (
        <Row
          key={artist.name}
          rank={i + 1}
          plays={artist.plays}
          detail={[
            plural(artist.plays, "listen"),
            artist.listeners && plural(artist.listeners, "listener"),
          ]
            .filter(Boolean)
            .join(", ")}
        >
          <span className="truncate font-medium">{artist.name}</span>
        </Row>
      ))}
    </List>
  );
}

export function TrackRanking({
  tracks,
}: {
  tracks: (TrackStat | ReleaseStat)[];
}) {
  return (
    <List empty="Nothing here yet.">
      {tracks.map((item, i) => {
        const name = "trackName" in item ? item.trackName : item.releaseName;

        return (
          <Row
            key={`${name}\u0000${item.artist}`}
            rank={i + 1}
            plays={item.plays}
            detail={plural(item.plays, "listen")}
          >
            <Cover releaseMbId={item.releaseMbId} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{name}</span>
              {item.artist && (
                <span className="block truncate text-sm text-neutral-600 dark:text-teal-100/60">
                  {item.artist}
                </span>
              )}
            </span>
          </Row>
        );
      })}
    </List>
  );
}
