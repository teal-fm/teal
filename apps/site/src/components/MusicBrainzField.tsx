import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Check, Link2, Search, Unlink } from "lucide-react";

import {
  lookup,
  MbNotFound,
  mbUrl,
  parseMbid,
  releasesOf,
  search,
  type MbEntity,
  type MbKind,
} from "~/lib/musicbrainz";
import { Cover } from "./Cover";

/** What a field is linked to: an MBID, plus its MusicBrainz name once known. */
export interface MbLink {
  id: string;
  name?: string;
}

/** Results to offer before anything is typed, like the releases a recording is on. */
export interface MbSuggestion {
  /** Changes whenever the suggestions would; a new key reloads them. */
  key: string;
  label: string;
  load: (signal: AbortSignal) => Promise<MbEntity[]>;
}

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; heading?: string; results: MbEntity[] }
  | { state: "error"; message: string };

const NOUN: Record<MbKind, string> = {
  recording: "recording",
  release: "release",
  artist: "artist",
};

async function find(
  kind: MbKind,
  text: string,
  signal: AbortSignal,
): Promise<{ heading?: string; results: MbEntity[] }> {
  const pasted = parseMbid(text);
  if (!pasted) return { results: await search(kind, text, signal) };

  if (kind === "release" && pasted.kind === "release-group") {
    return {
      heading: "Releases in that release group",
      results: await releasesOf("release-group", pasted.id, signal),
    };
  }
  if (pasted.kind && pasted.kind !== kind) {
    throw new Error(`That's a link to a ${pasted.kind}, not a ${NOUN[kind]}.`);
  }
  try {
    return { results: [await lookup(kind, pasted.id, signal)] };
  } catch (error) {
    if (error instanceof MbNotFound) {
      throw new Error(`MusicBrainz has no ${NOUN[kind]} with that ID.`);
    }
    throw error;
  }
}

/**
 * The MusicBrainz link under one of the editor's fields: what it's linked to,
 * and a search that finds something else to link, by name or by a pasted MBID
 * or musicbrainz.org link.
 */
export function MusicBrainzField({
  kind,
  label,
  linked,
  seed,
  suggestion,
  onPick,
  onUnlink,
}: {
  kind: MbKind;
  /** Names the field for screen readers, like "Artist 2". */
  label: string;
  linked?: MbLink;
  /** What the search starts with, usually the field's text. */
  seed: string;
  suggestion?: MbSuggestion;
  onPick: (entity: MbEntity) => void;
  onUnlink: () => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [active, setActive] = useState(-1);

  const suggestionKey = suggestion?.key;
  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    const offer = !typed && suggestion;
    if (!offer && text.length < 2) {
      setStatus({ state: "idle" });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setStatus({ state: "loading" });
        setActive(-1);
        try {
          let found: { heading?: string; results: MbEntity[] } | undefined;
          if (offer) {
            const results = await offer.load(controller.signal);
            if (results.length > 0) found = { heading: offer.label, results };
          }
          if (!found && text.length >= 2) {
            found = await find(kind, text, controller.signal);
          }
          setStatus({ state: "done", results: [], ...found });
        } catch (error) {
          if (controller.signal.aborted) return;
          setStatus({
            state: "error",
            message:
              error instanceof Error && error.message
                ? error.message
                : "Couldn't reach MusicBrainz.",
          });
        }
      },
      typed ? 400 : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The suggestion's key stands in for its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, typed, kind, suggestionKey]);

  function start() {
    setQuery(seed);
    setTyped(false);
    setStatus({ state: "idle" });
    setOpen(true);
    requestAnimationFrame(() => input.current?.select());
  }

  function pick(entity: MbEntity) {
    onPick(entity);
    setOpen(false);
  }

  const results = status.state === "done" ? status.results : [];

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Never submit the editor from in here.
      event.preventDefault();
      const chosen =
        results[active] ?? (results.length === 1 ? results[0] : undefined);
      if (chosen) pick(chosen);
    } else if (event.key === "Escape") {
      // Close the search, not the whole dialog.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  }

  const noun = NOUN[kind];
  const action =
    "inline-flex items-center gap-1 rounded text-teal-700 hover:underline dark:text-teal-300";

  return (
    <div className="mt-1.5 text-xs">
      {!open && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {linked ? (
            <>
              <a
                href={mbUrl(kind, linked.id)}
                target="_blank"
                rel="noreferrer"
                title={linked.id}
                className="inline-flex min-w-0 items-center gap-1 text-neutral-600 hover:underline dark:text-teal-100/70"
              >
                <Link2
                  aria-hidden
                  className="size-3.5 shrink-0 text-teal-600 dark:text-teal-300"
                />
                <span className="truncate">
                  {linked.name
                    ? `MusicBrainz: ${linked.name}`
                    : `MusicBrainz ${noun} ${linked.id.slice(0, 8)}`}
                </span>
                <ArrowUpRight aria-hidden className="size-3 shrink-0" />
              </a>
              <button
                type="button"
                onClick={start}
                aria-label={`Change the MusicBrainz ${noun} for ${label}`}
                className={action}
              >
                Change
              </button>
              <button
                type="button"
                onClick={onUnlink}
                aria-label={`Unlink the MusicBrainz ${noun} from ${label}`}
                className="inline-flex items-center gap-1 rounded text-neutral-500 hover:underline dark:text-teal-100/50"
              >
                <Unlink aria-hidden className="size-3" /> Unlink
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={start}
              aria-label={`Link ${label} to a MusicBrainz ${noun}`}
              className={action}
            >
              <Link2 aria-hidden className="size-3.5" /> Link a MusicBrainz{" "}
              {noun}
            </button>
          )}
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.04] p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-teal-600 dark:text-teal-300"
            />
            <input
              ref={input}
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setTyped(true);
              }}
              onKeyDown={onKeyDown}
              placeholder={`Search, or paste a ${noun} MBID or link`}
              aria-label={`Find a MusicBrainz ${noun} for ${label}`}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={id}
              aria-activedescendant={
                active >= 0 ? `${id}-${active}` : undefined
              }
              className="w-full rounded-lg border border-neutral-400/30 bg-white/80 py-1.5 pl-8 pr-2 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 dark:bg-gray-950/60"
            />
          </div>

          <div
            aria-live="polite"
            className="px-1 pt-1.5 text-neutral-500 empty:hidden dark:text-teal-100/50"
          >
            {status.state === "loading" && "Searching MusicBrainz…"}
            {status.state === "error" && (
              <span className="text-red-700 dark:text-red-300">
                {status.message}
              </span>
            )}
            {status.state === "done" &&
              (results.length === 0 ? `No ${noun}s found.` : status.heading)}
          </div>

          {results.length > 0 && (
            <ul
              id={id}
              role="listbox"
              aria-label={`MusicBrainz ${noun}s`}
              className="mt-1 max-h-64 overflow-y-auto"
            >
              {results.map((entity, i) => (
                <li
                  key={entity.id}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(entity)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-teal-500/10 aria-selected:bg-teal-500/15"
                >
                  {kind === "release" && (
                    <Cover key={entity.id} releaseMbId={entity.id} size={36} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{entity.name}</span>
                      {entity.disambiguation && (
                        <span className="text-neutral-500 dark:text-teal-100/50">
                          {" "}
                          ({entity.disambiguation})
                        </span>
                      )}
                    </p>
                    {entity.details.length > 0 && (
                      <p className="truncate text-neutral-600 dark:text-teal-100/60">
                        {entity.details.join(" · ")}
                      </p>
                    )}
                  </div>
                  {entity.id === linked?.id && (
                    <Check
                      aria-label="Linked now"
                      className="size-4 shrink-0 text-teal-600 dark:text-teal-300"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
            <a
              href={`https://musicbrainz.org/search?type=${kind}&query=${encodeURIComponent(query.trim() || seed)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-neutral-500 hover:underline dark:text-teal-100/50"
            >
              Search on musicbrainz.org{" "}
              <ArrowUpRight aria-hidden className="size-3" />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1 font-medium text-neutral-600 hover:underline dark:text-teal-100/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
