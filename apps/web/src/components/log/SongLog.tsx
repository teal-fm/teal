import { useState, type FormEvent } from "react";
import { Check, ExternalLink, Search } from "lucide-react";
import { $validate as validatePlay } from "@teal/lexicons/src/fm/teal/feed/play";
import { createPlayRecordFromRecording } from "@teal/client/manualListens";
import { searchMusicbrainz, type MusicBrainzRecording, type MusicBrainzRelease } from "@teal/client/oldStamp";
import { retainConfirmedListens } from "@teal/client/pendingListenStore";
import { usePdsAgent } from "@teal/client/session";
import { crossPostListen, crossPostText } from "@teal/client/teal/crosspost";
import { listenHrefFromUri } from "@teal/client/teal/routes";
import { cn } from "@teal/client/utils";
import { Button, ButtonRow, Cover, ErrorNotice, Field, Glass, Heading, Icon, LinkButton, Loading, Notice, TextArea } from "~/ds";

import { Switch } from "./Switch";

const artistNames = (recording: MusicBrainzRecording) =>
  recording["artist-credit"]?.map((credit) => credit.name || credit.artist.name).join(", ") || "Unknown artist";

/** The edition to suggest first: the earliest worldwide or US release that isn't just the single. */
function suggestedRelease(recording: MusicBrainzRecording) {
  const releases = [...(recording.releases || [])].sort(
    (a, b) => (a.date || "ZZZ").localeCompare(b.date || "ZZZ") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  return (
    releases.find((r) => (r.country === "XW" || r.country === "US") && r.title !== recording.title) ||
    releases.find((r) => r.title !== recording.title) ||
    releases[0]
  );
}

function Result({ recording, chosen, onChoose }: { recording: MusicBrainzRecording; chosen: boolean; onChoose: (release?: MusicBrainzRelease) => void }) {
  const [release, setRelease] = useState(suggestedRelease(recording));
  const [showEditions, setShowEditions] = useState(false);
  const editions = recording.releases ?? [];
  return (
    <div className={cn("flex flex-col gap-2 rounded-[16px] p-3", chosen ? "bg-tint-soft" : "bg-fill")}>
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        aria-label={`${recording.title} by ${artistNames(recording)}`}
        onClick={() => onChoose(release)}
        className="flex items-center gap-3 text-left"
      >
        <Cover releaseMbId={release?.id} size={52} radius={8} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-ink">{recording.title}</span>
          <span className="truncate text-[14px] text-ink-2">
            {artistNames(recording)}
            {release ? ` · ${release.title}` : ""}
          </span>
        </span>
        {chosen ? <Icon icon={Check} size={20} className="text-tint" /> : null}
      </button>
      {editions.length > 1 ? (
        <button type="button" aria-expanded={showEditions} onClick={() => setShowEditions((s) => !s)} className="self-start text-[13px] font-semibold text-tint hover:underline">
          {showEditions ? "Hide editions" : `Choose from ${editions.length} editions`}
        </button>
      ) : null}
      {showEditions ? (
        <div role="radiogroup" aria-label="Edition" className="flex flex-col gap-1">
          {editions.map((edition) => (
            <button
              key={edition.id}
              type="button"
              role="radio"
              aria-checked={edition.id === release?.id}
              onClick={() => {
                setRelease(edition);
                onChoose(edition);
              }}
              className={cn("flex flex-col rounded-[10px] px-2.5 py-2 text-left hover:bg-fill", edition.id === release?.id && "bg-tint-soft")}
            >
              <span className="truncate text-[14px]">{edition.title}</span>
              <span className="text-[12px] text-ink-2">{[edition.date, edition.country, edition.status].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Saved = { listenUri: string; blueskyUrl?: string; crossPostFailed?: boolean };

/** Log one song you just heard: search MusicBrainz, pick the edition, and save it (optionally posting to Bluesky). */
export function SongLog() {
  const agent = usePdsAgent();
  const [fields, setFields] = useState({ track: "", artist: "", release: "" });
  const [results, setResults] = useState<MusicBrainzRecording[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [chosen, setChosen] = useState<MusicBrainzRecording | null>(null);
  const [crossPost, setCrossPost] = useState(false);
  const [postText, setPostText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: event.target.value }));

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!fields.track.trim() && !fields.artist.trim() && !fields.release.trim()) return;
    setSearching(true);
    setSearchFailed(false);
    setChosen(null);
    try {
      setResults(await searchMusicbrainz(fields, { throwOnError: true }));
    } catch {
      setResults(null);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const choose = (recording: MusicBrainzRecording, release?: MusicBrainzRelease) => {
    const next = { ...recording, selectedRelease: release };
    setChosen(next);
    setPostText(crossPostText(next));
    setError(null);
  };

  const save = async () => {
    if (!agent?.did || !chosen || saving) return;
    setSaving(true);
    setError(null);
    try {
      const record = createPlayRecordFromRecording(chosen);
      validatePlay(record);
      const res = await agent.call("com.atproto.repo.createRecord", {}, { repo: agent.did, collection: "fm.teal.feed.play", record });
      const { uri, cid } = res.data as { uri: string; cid: string };
      retainConfirmedListens(agent.did, [{ record, uri, cid }]);
      let result: Saved = { listenUri: uri };
      if (crossPost) {
        // The listen is saved; a failed cross-post must never prompt a second listen write.
        try {
          result = { ...result, blueskyUrl: await crossPostListen(agent, postText, chosen, artistNames(chosen)) };
        } catch {
          result = { ...result, crossPostFailed: true };
        }
      }
      setSaved(result);
    } catch {
      setError("Your listen didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSaved(null);
    setChosen(null);
    setResults(null);
    setFields({ track: "", artist: "", release: "" });
    setCrossPost(false);
  };

  if (saved) {
    const href = listenHrefFromUri(saved.listenUri);
    return (
      <Notice
        center
        icon={Check}
        title="Listen saved"
        body={saved.crossPostFailed ? "Your listen is saved, but the Bluesky post didn't go out." : "It's in your history now. Feeds can take a moment to catch up."}
        action={
          <ButtonRow className="justify-center">
            {href ? <LinkButton href={href} label="See it" variant="secondary" /> : null}
            {saved.blueskyUrl ? <LinkButton href={saved.blueskyUrl} target="_blank" label="Open on Bluesky" icon={ExternalLink} variant="secondary" /> : null}
            <Button label="Log another" onClick={reset} />
          </ButtonRow>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Glass className="p-4">
        <form role="search" onSubmit={search} className="flex flex-col gap-3">
          <Field label="Song" value={fields.track} onChange={set("track")} enterKeyHint="search" />
          <Field label="Artist" value={fields.artist} onChange={set("artist")} enterKeyHint="search" />
          <Field label="Album (optional)" value={fields.release} onChange={set("release")} enterKeyHint="search" />
          <Button type="submit" label="Search" icon={Search} loading={searching} />
        </form>
      </Glass>

      {searchFailed ? (
        <ErrorNotice title="MusicBrainz didn't answer" body="Search is unavailable for a moment. Try again." onRetry={() => void search()} />
      ) : searching ? (
        <Loading />
      ) : results && results.length === 0 ? (
        <Notice title="No songs found" body="Try fewer words, or check the spelling of the artist." />
      ) : results ? (
        <div role="radiogroup" aria-label="Song" className="flex flex-col gap-2">
          {results.map((recording) => (
            <Result key={recording.id} recording={recording} chosen={chosen?.id === recording.id} onChoose={(release) => choose(recording, release)} />
          ))}
        </div>
      ) : null}

      {chosen ? (
        <Glass strong as="section" className="flex flex-col gap-3 p-4">
          <Heading level={2} size="card">
            Save {chosen.title}
          </Heading>
          <p className="text-[14px] text-ink-2">This listen uses the current time.</p>
          <Switch label="Also post to Bluesky" checked={crossPost} onChange={setCrossPost} />
          {crossPost ? <TextArea label="Bluesky post" value={postText} onChange={(e) => setPostText(e.target.value)} maxLength={300} /> : null}
          {error ? (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          ) : null}
          <Button label={saving ? "Saving" : "Save listen"} loading={saving} onClick={save} />
          <a
            href={`https://musicbrainz.org/recording/${chosen.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-[13px] text-ink-2"
          >
            Missing details? <span className="font-semibold text-tint hover:underline">Fix them on MusicBrainz</span>
          </a>
        </Glass>
      ) : null}
    </div>
  );
}
