import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { PlaysWithProfiles } from "~/lib/api";
import { playKey, useLivePlays, type LiveStatus } from "~/lib/live";
import { Card, Empty } from "./Card";
import { PlayRow } from "./PlayList";

const LABELS: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  offline: "Reconnecting",
  paused: "Paused",
};

/** Shows the feed's state; pressing it pauses or resumes the feed. */
function LiveBadge({
  status,
  paused,
  onToggle,
}: {
  status: LiveStatus;
  paused: boolean;
  onToggle: () => void;
}) {
  const live = status === "live";

  return (
    <button
      type="button"
      aria-pressed={!paused}
      title={paused ? "Resume live updates" : "Pause live updates"}
      onClick={onToggle}
      className="-my-1 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium uppercase tracking-wider text-teal-700 transition hover:bg-teal-500/10 dark:text-teal-300"
    >
      <span aria-hidden className="relative flex size-2">
        {live && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-60 motion-reduce:animate-none" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${live ? "bg-teal-500" : paused ? "border border-current" : "bg-neutral-400"}`}
        />
      </span>
      <span role="status">{LABELS[status]}</span>
    </button>
  );
}

/** The newest listens, kept current over Jetstream until paused. */
export function LivePlays({
  initial,
  limit = 8,
}: {
  initial: PlaysWithProfiles;
  limit?: number;
}) {
  const { plays, profiles, status, paused, setPaused, replace } =
    useLivePlays(initial, limit);

  return (
    <Card
      title="Just played"
      badge={
        <LiveBadge
          status={status}
          paused={paused}
          onToggle={() => setPaused(!paused)}
        />
      }
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
              onChange={(next) => replace(play.uri, next)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
