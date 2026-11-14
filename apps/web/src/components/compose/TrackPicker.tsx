import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { searchMusicbrainz } from "@teal/client/oldStamp";
import { displayArtists, getActorFeed } from "@teal/client/teal/api";
import { musicBrainzToPlayView } from "@teal/client/teal/compose";
import { useViewerDid } from "@teal/client/teal/queries";
import { cn } from "@teal/client/utils";
import { Button, Cover, Field, Icon, Loading } from "~/ds";

function TrackOption({ play, selected, onSelect }: { play: PlayView; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${play.trackName} by ${displayArtists(play) || "Unknown artist"}`}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] border p-2.5 text-left active:opacity-70",
        selected ? "border-tint bg-tint-soft" : "border-transparent hover:bg-fill",
      )}
    >
      <Cover releaseMbId={play.releaseMbId} size={44} radius={8} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">{play.trackName}</span>
        <span className="truncate text-[14px] text-ink-2">{[displayArtists(play) || "Unknown artist", play.releaseName].filter(Boolean).join(" · ")}</span>
      </span>
      {selected ? <Icon icon={Check} size={18} className="text-tint" /> : null}
    </button>
  );
}

/** Choose the song for a post: something you played recently, or anything on MusicBrainz. */
export function TrackPicker({
  selected,
  onSelect,
  autoSelect,
}: {
  selected: PlayView | null;
  onSelect: (play: PlayView) => void;
  /** Start on the most recent play when nothing is chosen yet. */
  autoSelect?: boolean;
}) {
  const viewer = useViewerDid();
  const recent = useQuery({
    queryKey: ["actor-plays-recent", viewer],
    queryFn: () => getActorFeed(viewer!, 20).then((r) => r.plays),
    enabled: !!viewer,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayView[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (autoSelect && !selected && recent.data?.[0]) onSelect(recent.data[0]);
  }, [autoSelect, recent.data, selected, onSelect]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(false);
    try {
      const found = await searchMusicbrainz({ track: q, artist: "", release: "" }, { throwOnError: true });
      setResults(found.slice(0, 8).map((r) => musicBrainzToPlayView(r)));
    } catch {
      setError(true);
    } finally {
      setSearching(false);
    }
  };

  const list = results ?? recent.data ?? [];
  return (
    <div className="flex flex-col gap-2">
      <form role="search" onSubmit={search} className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Find a song"
            hideLabel
            type="search"
            placeholder="Search for any song"
            value={query}
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) setResults(null);
            }}
          />
        </div>
        <Button type="submit" label="Search" icon={Search} variant="secondary" loading={searching} />
      </form>
      <p className="text-[13px] font-semibold text-ink-2">{results ? "Search results" : "Played recently"}</p>
      {error ? (
        <p role="alert" className="text-[14px] text-destructive">
          Search didn't go through. Try again.
        </p>
      ) : null}
      {recent.isLoading && !results ? (
        <Loading className="py-6" />
      ) : list.length === 0 ? (
        <p className="text-[14px] text-ink-2">{results ? "No songs found." : "Search for the song you want to post."}</p>
      ) : (
        <div role="radiogroup" aria-label="Song" className="flex flex-col gap-1">
          {list.map((play, i) => (
            <TrackOption
              key={`${play.uri ?? play.recordingMbId ?? play.trackName}-${i}`}
              play={play}
              selected={!!selected && (selected.uri ?? selected.recordingMbId) === (play.uri ?? play.recordingMbId)}
              onSelect={() => onSelect(play)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
