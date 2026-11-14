import { useMemo, useState, type FormEvent } from "react";
import { Check, Search } from "lucide-react";
import {
  buildListenTimeline,
  buildManualListenRecords,
  effectiveDurationSeconds,
  flattenTracks,
  formatDuration,
  getMusicBrainzRelease,
  localDateTimeValue,
  parseLocalDateTime,
  releaseArtist,
  releaseDetails,
  searchMusicBrainzReleases,
  submitManualListenRecords,
  type ListenTimestampMode,
  type MusicBrainzAlbumRelease,
} from "@teal/client/manualListens";
import { retainConfirmedListens } from "@teal/client/pendingListenStore";
import { usePdsAgent } from "@teal/client/session";
import { cn } from "@teal/client/utils";
import { Button, ButtonRow, Choices, Cover, ErrorNotice, Field, Glass, Heading, Icon, LinkButton, Loading, Notice, Row } from "~/ds";

const WHEN: readonly { value: ListenTimestampMode; label: string }[] = [
  { value: "now", label: "Just finished" },
  { value: "custom", label: "Started at a time" },
];

/** Log a whole album, or part of it: pick the edition, choose tracks, and say when you listened. */
export function AlbumLog() {
  const agent = usePdsAgent();
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<MusicBrainzAlbumRelease[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [release, setRelease] = useState<MusicBrainzAlbumRelease | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ListenTimestampMode>("now");
  const [start, setStart] = useState(() => localDateTimeValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const tracks = useMemo(() => (release ? flattenTracks(release) : []), [release]);
  const chosen = tracks.filter((track) => selected.has(track.key));
  const startDate = parseLocalDateTime(start);
  const timeline = useMemo(() => {
    try {
      return chosen.length ? buildListenTimeline(chosen, mode, startDate, new Date()) : [];
    } catch {
      return [];
    }
  }, [chosen, mode, startDate]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!album.trim()) return;
    setSearching(true);
    setSearchFailed(false);
    setRelease(null);
    try {
      setResults(await searchMusicBrainzReleases(album, artist));
    } catch {
      setResults(null);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const pick = async (candidate: MusicBrainzAlbumRelease) => {
    setLoadingRelease(true);
    setError(null);
    try {
      const details = await getMusicBrainzRelease(candidate.id);
      const list = flattenTracks(details);
      if (!list.length) throw new Error("no tracks");
      setRelease(details);
      setSelected(new Set(list.map((t) => t.key)));
      setSavedCount(null);
    } catch {
      setError("That edition didn't load its tracks. Try another one.");
    } finally {
      setLoadingRelease(false);
    }
  };

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    if (!agent || !release || !chosen.length || saving) return;
    if (mode === "custom" && !startDate) {
      setError("Enter a valid start date and time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const records = buildManualListenRecords(release, chosen, mode, startDate, new Date());
      setSavedCount(await submitManualListenRecords(agent, records, (writes) => agent.did && retainConfirmedListens(agent.did, writes)));
    } catch {
      setError("Your listens didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (savedCount !== null && release) {
    return (
      <Notice
        center
        icon={Check}
        title={`${savedCount} ${savedCount === 1 ? "listen" : "listens"} saved`}
        body={`${release.title} is in your history now.`}
        action={
          <ButtonRow className="justify-center">
            {agent?.did ? <LinkButton href={`/profile/${agent.did}?tab=listening`} label="See your history" variant="secondary" /> : null}
            <Button
              label="Log another album"
              onClick={() => {
                setSavedCount(null);
                setRelease(null);
                setResults(null);
                setAlbum("");
                setArtist("");
              }}
            />
          </ButtonRow>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Glass className="p-4">
        <form role="search" onSubmit={search} className="flex flex-col gap-3">
          <Field label="Album" value={album} onChange={(e) => setAlbum(e.target.value)} enterKeyHint="search" />
          <Field label="Artist (optional)" value={artist} onChange={(e) => setArtist(e.target.value)} enterKeyHint="search" />
          <Button type="submit" label="Search" icon={Search} loading={searching} disabled={!album.trim()} />
        </form>
      </Glass>

      {searchFailed ? (
        <ErrorNotice title="MusicBrainz didn't answer" body="Album search is unavailable for a moment. Try again." onRetry={() => void search()} />
      ) : searching ? (
        <Loading />
      ) : results && !release ? (
        results.length === 0 ? (
          <Notice title="No albums found" body="Try the album's exact title, or add the artist." />
        ) : (
          <Glass as="section" className="px-4 py-1">
            <Heading level={2} size="card" className="pt-3">
              Choose an edition
            </Heading>
            {results.map((candidate, i) => (
              <Row
                key={candidate.id}
                onClick={() => pick(candidate)}
                leading={<Cover releaseMbId={candidate.id} size={48} radius={8} />}
                title={candidate.title}
                subtitle={releaseArtist(candidate)}
                meta={releaseDetails(candidate)}
                divider={i < results.length - 1}
              />
            ))}
          </Glass>
        )
      ) : null}
      {loadingRelease ? <Loading /> : null}
      {error && !release ? (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      ) : null}

      {release ? (
        <Glass strong as="section" className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <Cover releaseMbId={release.id} size={64} radius={10} />
            <div className="min-w-0 flex-1">
              <Heading level={2} size="card" className="line-clamp-2">
                {release.title}
              </Heading>
              <p className="text-[14px] text-ink-2">{releaseArtist(release)}</p>
            </div>
            <Button label="Change" size="sm" variant="plain" onClick={() => setRelease(null)} />
          </div>
          <ButtonRow>
            <Button label="Select all" size="sm" variant="secondary" onClick={() => setSelected(new Set(tracks.map((t) => t.key)))} />
            <Button label="Clear" size="sm" variant="secondary" onClick={() => setSelected(new Set())} />
            <span className="text-[14px] tabular-nums text-ink-2" aria-live="polite">
              {chosen.length} of {tracks.length}
            </span>
          </ButtonRow>
          <div className="flex flex-col gap-0.5" role="group" aria-label="Tracks">
            {tracks.map((track) => {
              const on = selected.has(track.key);
              return (
                <button
                  key={track.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(track.key)}
                  className={cn("flex items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-fill", on && "bg-tint-soft hover:bg-tint-soft")}
                >
                  <span aria-hidden className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-tint bg-tint" : "border-hair")}>
                    {on ? <Icon icon={Check} size={12} className="text-on-tint" /> : null}
                  </span>
                  <span className="w-6 text-[13px] tabular-nums text-ink-2">{track.number || track.position || ""}</span>
                  <span className="min-w-0 flex-1 truncate">{track.recording.title || track.title || "Untitled track"}</span>
                  <span className="text-[13px] tabular-nums text-ink-2">{formatDuration(effectiveDurationSeconds(track))}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-semibold">When did you listen?</p>
            <Choices label="When did you listen?" value={mode} onChange={setMode} options={WHEN} />
            {mode === "custom" ? <Field label="Started at" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /> : null}
            {timeline.length ? (
              <p className="text-[13px] text-ink-2">
                First listen {new Date(timeline[0].playedTime).toLocaleString()}, last {new Date(timeline[timeline.length - 1].playedTime).toLocaleString()}.
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          ) : null}
          <Button
            label={saving ? "Saving" : `Save ${chosen.length} ${chosen.length === 1 ? "listen" : "listens"}`}
            loading={saving}
            disabled={!chosen.length}
            onClick={save}
          />
        </Glass>
      ) : null}
    </div>
  );
}
