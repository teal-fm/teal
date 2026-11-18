import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

import type { Profile } from "~/lib/types";
import { Avatar } from "./Avatar";

/** Bluesky's typeahead is public and CORS-open, so suggestions come straight from the browser. */
async function suggest(q: string, signal: AbortSignal): Promise<Profile[]> {
  const response = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?limit=6&q=${encodeURIComponent(q)}`,
    { signal },
  );
  if (!response.ok) return [];

  return ((await response.json()) as { actors: Profile[] }).actors;
}

export function SearchBox({
  size = "lg",
  autoFocus,
}: {
  size?: "lg" | "sm";
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      suggest(q, controller.signal)
        .then((actors) => {
          setResults(actors);
          setActive(-1);
        })
        .catch(() => {});
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(actor: string) {
    const handle = actor.trim().replace(/^@/, "");
    if (!handle) return;
    setOpen(false);
    setQuery("");
    void navigate({ to: "/profile/$handle", params: { handle } });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(
      active >= 0 && results[active]
        ? (results[active].handle ?? results[active].did)
        : query,
    );
  }

  const showList = open && results.length > 0;
  const large = size === "lg";

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Look up a listener by handle
      </label>
      <Search
        aria-hidden
        className={`pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-teal-600 dark:text-teal-300 ${large ? "left-5 size-5" : "left-3 size-4"}`}
      />
      <input
        id={`${listId}-input`}
        type="search"
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={
          large ? "Look up anyone, like alice.bsky.social" : "Look up a handle"
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={`w-full rounded-full border border-teal-500/30 bg-white/60 text-neutral-900 shadow-sm outline-none backdrop-blur-lg transition placeholder:text-neutral-500 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 dark:bg-gray-900/60 dark:text-white dark:placeholder:text-teal-100/40 ${large ? "pl-13 py-4 pr-5 text-lg" : "py-2 pl-9 pr-4 text-sm"}`}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-neutral-400/20 bg-white/90 py-1 text-left shadow-xl backdrop-blur-xl dark:bg-gray-900/95"
        >
          {results.map((actor, i) => (
            <li
              key={actor.did}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault();
                go(actor.handle ?? actor.did);
              }}
              className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-teal-500/10 aria-selected:bg-teal-500/15"
            >
              <Avatar profile={actor} size={28} />
              <span className="min-w-0 truncate">
                <span className="font-medium">
                  {actor.displayName || actor.handle}
                </span>{" "}
                <span className="text-sm text-neutral-500 dark:text-teal-100/50">
                  @{actor.handle}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
