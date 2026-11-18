import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { PlaysWithProfiles } from "~/lib/api";
import { playKey, useLivePlays, type LiveStatus } from "~/lib/live";
import { Card, Empty } from "./Card";
import { PlayRow } from "./PlayList";

function LiveBadge({ status }: { status: LiveStatus }) {
  // Nothing until the socket first opens, so the server render stays quiet.
  if (status === "connecting") return null;
  const live = status === "live";

  return (
    <span
      role="status"
      className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-teal-700 dark:text-teal-300"
    >
      <span aria-hidden className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-60 motion-reduce:animate-none" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${live ? "bg-teal-500" : "bg-neutral-400"}`}
        />
      </span>
      {live ? "Live" : "Reconnecting"}
    </span>
  );
}

/** The newest listens, kept current over Jetstream. */
export function LivePlays({
  initial,
  limit = 8,
}: {
  initial: PlaysWithProfiles;
  limit?: number;
}) {
  const { plays, profiles, status } = useLivePlays(initial, limit);

  return (
    <Card
      title="Just played"
      badge={<LiveBadge status={status} />}
      action={
        <Link
          to="/listens"
          className="flex items-center gap-1 text-sm text-teal-700 hover:underline dark:text-teal-300"
        >
          Everyone's listens <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      {plays.length === 0 ? (
        <Empty>
          {status === "live"
            ? "Waiting for the next listen…"
            : "No listens yet."}
        </Empty>
      ) : (
        <ul className="divide-y divide-neutral-400/15">
          {plays.map((play) => (
            <PlayRow
              key={playKey(play)}
              play={play}
              profiles={profiles}
              className={play.live ? "play-in" : ""}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
