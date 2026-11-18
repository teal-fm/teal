import { useEffect, useState } from "react";

import { subscribe } from "~/lib/jetstream";
import {
  newest,
  STATUS_COLLECTIONS,
  statusOf,
  type NowPlaying as Status,
} from "~/lib/status";

/** setTimeout fires at once past this, so longer waits are capped. */
const MAX_DELAY_MS = 2 ** 31 - 1;

/** Three bars that bob while something plays; still for reduced motion. */
function Bars() {
  return (
    <span aria-hidden className="flex h-3.5 shrink-0 items-end gap-[3px]">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="eq-bar w-[3px] rounded-full bg-teal-500"
          style={{ animationDelay: `${bar * -0.35}s` }}
        />
      ))}
    </span>
  );
}

/**
 * "Listening now" for one person, from their fm.teal.actor.status. It follows
 * the status over Jetstream while the page is open and disappears when the
 * status expires. Key it by DID so a new profile starts fresh.
 */
export function NowPlaying({
  did,
  initial,
}: {
  did: string;
  initial: Status | null;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status | undefined>>(
    initial ? { [initial.collection]: initial } : {},
  );
  const current = newest(Object.values(statuses));

  useEffect(
    () =>
      subscribe({
        collections: STATUS_COLLECTIONS,
        dids: [did],
        onCommit: ({ did: author, commit }) => {
          if (author !== did || !commit) return;
          if (!STATUS_COLLECTIONS.includes(commit.collection)) return;
          const next =
            commit.operation === "delete"
              ? undefined
              : statusOf(commit.collection, commit.record);
          setStatuses((all) => ({ ...all, [commit.collection]: next }));
        },
      }),
    [did],
  );

  useEffect(() => {
    if (!current) return;
    const delay = Date.parse(current.expiresAt) - Date.now();
    const timer = setTimeout(
      () =>
        setStatuses((all) =>
          all[current.collection] === current
            ? { ...all, [current.collection]: undefined }
            : all,
        ),
      Math.min(Math.max(0, delay), MAX_DELAY_MS),
    );

    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  const byline = current.artists.join(", ");

  return (
    <p className="mt-3 flex max-w-full items-center gap-2.5 rounded-full border border-teal-500/25 bg-teal-500/10 py-1.5 pl-3 pr-4 text-sm sm:w-fit">
      <Bars />
      <span className="min-w-0 truncate">
        <span className="text-teal-800 dark:text-teal-200">
          Listening now:
        </span>{" "}
        {current.originUrl ? (
          <a
            href={current.originUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium hover:underline"
          >
            {current.trackName}
          </a>
        ) : (
          <span className="font-medium">{current.trackName}</span>
        )}
        {byline && (
          <span className="text-neutral-600 dark:text-teal-100/60">
            {" "}
            · {byline}
          </span>
        )}
      </span>
    </p>
  );
}
