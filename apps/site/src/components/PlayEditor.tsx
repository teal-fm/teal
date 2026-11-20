import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { useAuth } from "~/lib/auth";
import { mbid } from "~/lib/format";
import { recordingsByIsrc, releasesOf, type MbEntity } from "~/lib/musicbrainz";
import type { Play } from "~/lib/types";
import {
  MusicBrainzField,
  type MbLink,
  type MbSuggestion,
} from "./MusicBrainzField";

const field =
  "w-full rounded-lg border border-neutral-400/30 bg-white/70 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 dark:bg-gray-950/60";
const label = "mb-1 block text-sm font-medium";

interface ArtistDraft {
  /** Keeps React's rows straight as artists come and go. */
  key: number;
  name: string;
  link?: MbLink;
}

let nextKey = 0;
const draft = (name: string, id?: string, linkName?: string): ArtistDraft => ({
  key: nextKey++,
  name,
  link: id ? { id, name: linkName } : undefined,
});

const linkOf = (value?: string): MbLink | undefined => {
  const id = mbid(value);
  return id ? { id } : undefined;
};

/**
 * Edits or deletes one of the signed-in person's plays, including which
 * MusicBrainz recording, release and artists it's linked to. `onDone` gets
 * the edited play, or null once it's deleted.
 */
export function PlayEditor({
  play,
  onDone,
  onClose,
}: {
  play: Play;
  onDone: (play: Play | null) => void;
  onClose: () => void;
}) {
  const { call } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [trackName, setTrackName] = useState(play.trackName);
  const [artists, setArtists] = useState<ArtistDraft[]>(() =>
    play.artists.length > 0
      ? play.artists.map((name, i) => draft(name, mbid(play.artistMbIds?.[i])))
      : [draft("")],
  );
  const [releaseName, setReleaseName] = useState(play.releaseName ?? "");
  const [recording, setRecording] = useState(() => linkOf(play.recordingMbId));
  const [release, setRelease] = useState(() => linkOf(play.releaseMbId));
  const [busy, setBusy] = useState<"save" | "delete">();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function run(kind: "save" | "delete", action: () => Promise<void>) {
    setBusy(kind);
    setError(undefined);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(undefined);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const credits = artists
      .map((artist) => ({
        name: artist.name.trim(),
        mbid: artist.link?.id ?? "",
      }))
      .filter((artist) => artist.name);
    const edited = {
      trackName: trackName.trim(),
      releaseName: releaseName.trim() || undefined,
      // An empty ID unlinks.
      recordingMbId: recording?.id ?? "",
      releaseMbId: release?.id ?? "",
    };
    void run("save", async () => {
      await call("fm.teal.site.updatePlay", {
        uri: play.uri,
        ...edited,
        artists: credits,
      });
      onDone({
        ...play,
        trackName: edited.trackName,
        releaseName: edited.releaseName,
        artists: credits.map((artist) => artist.name),
        artistMbIds: credits.some((artist) => artist.mbid)
          ? credits.map((artist) => artist.mbid && `mbid:${artist.mbid}`)
          : undefined,
        recordingMbId: recording && `mbid:${recording.id}`,
        releaseMbId: release && `mbid:${release.id}`,
      });
    });
  }

  /** Linking a recording takes its title and credited artists too. */
  function pickRecording(entity: MbEntity) {
    setRecording({ id: entity.id, name: entity.name });
    setTrackName(entity.name);
    if (entity.artists && entity.artists.length > 0) {
      setArtists(
        entity.artists.map((artist) =>
          draft(artist.name, artist.id, artist.name),
        ),
      );
    }
  }

  function pickRelease(entity: MbEntity) {
    setRelease({ id: entity.id, name: entity.name });
    setReleaseName(entity.name);
  }

  const isrc = play.isrc;
  const recordingSuggestion: MbSuggestion | undefined = isrc
    ? {
        key: `isrc:${isrc}`,
        label: `Recordings with this listen's ISRC (${isrc})`,
        load: (signal) => recordingsByIsrc(isrc, signal),
      }
    : undefined;
  const recordingId = recording?.id;
  const releaseSuggestion: MbSuggestion | undefined = recordingId
    ? {
        key: `recording:${recordingId}`,
        label: "Releases with the linked recording",
        load: (signal) => releasesOf("recording", recordingId, signal),
      }
    : undefined;

  function remove() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void run("delete", async () => {
      await call("fm.teal.site.deletePlay", { uri: play.uri });
      onDone(null);
    });
  }

  const setArtist = (index: number, change: Partial<ArtistDraft>) =>
    setArtists((current) =>
      current.map((artist, i) =>
        i === index ? { ...artist, ...change } : artist,
      ),
    );
  const artistSeed = artists
    .map((artist) => artist.name.trim())
    .filter(Boolean)
    .join(" ");

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="play-editor-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-neutral-400/20 bg-white p-0 text-left text-neutral-800 shadow-2xl backdrop:bg-gray-950/50 backdrop:backdrop-blur-sm dark:bg-gray-900 dark:text-white"
    >
      <form onSubmit={save} className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="play-editor-title" className="text-lg font-semibold">
            Edit listen
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
            className="-m-1 rounded-full p-1 text-neutral-500 hover:bg-neutral-500/10"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div>
          <label htmlFor="play-track" className={label}>
            Track
          </label>
          <input
            id="play-track"
            required
            maxLength={256}
            value={trackName}
            onChange={(event) => setTrackName(event.target.value)}
            className={field}
          />
          <MusicBrainzField
            kind="recording"
            label="the track"
            linked={recording}
            seed={[trackName.trim(), artistSeed].filter(Boolean).join(" ")}
            suggestion={recordingSuggestion}
            onPick={pickRecording}
            onUnlink={() => setRecording(undefined)}
          />
        </div>

        <fieldset>
          <legend className={label}>Artists</legend>
          <div className="flex flex-col gap-2">
            {artists.map((artist, index) => (
              <div key={artist.key}>
                <div className="flex gap-2">
                  <input
                    aria-label={`Artist ${index + 1}`}
                    maxLength={256}
                    value={artist.name}
                    onChange={(event) =>
                      setArtist(index, { name: event.target.value })
                    }
                    className={field}
                  />
                  {artists.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove artist ${index + 1}`}
                      onClick={() =>
                        setArtists(artists.filter((_, i) => i !== index))
                      }
                      className="shrink-0 rounded-lg px-2 text-neutral-500 hover:bg-neutral-500/10"
                    >
                      <X aria-hidden className="size-4" />
                    </button>
                  )}
                </div>
                <MusicBrainzField
                  kind="artist"
                  label={`artist ${index + 1}`}
                  linked={artist.link}
                  seed={artist.name.trim()}
                  onPick={(entity) =>
                    setArtist(index, {
                      name: entity.name,
                      link: { id: entity.id, name: entity.name },
                    })
                  }
                  onUnlink={() => setArtist(index, { link: undefined })}
                />
              </div>
            ))}
          </div>
          {artists.length < 32 && (
            <button
              type="button"
              onClick={() => setArtists([...artists, draft("")])}
              className="mt-2 flex items-center gap-1 text-sm text-teal-700 hover:underline dark:text-teal-300"
            >
              <Plus aria-hidden className="size-4" /> Add artist
            </button>
          )}
        </fieldset>

        <div>
          <label htmlFor="play-release" className={label}>
            Album
          </label>
          <input
            id="play-release"
            maxLength={256}
            value={releaseName}
            onChange={(event) => setReleaseName(event.target.value)}
            className={field}
          />
          <MusicBrainzField
            kind="release"
            label="the album"
            linked={release}
            seed={[releaseName.trim(), artistSeed].filter(Boolean).join(" ")}
            suggestion={releaseSuggestion}
            onPick={pickRelease}
            onUnlink={() => setRelease(undefined)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-1 flex flex-wrap-reverse items-center justify-between gap-3">
          <button
            type="button"
            onClick={remove}
            disabled={busy !== undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${confirming ? "bg-red-600 text-white hover:bg-red-700" : "text-red-700 hover:bg-red-500/10 dark:text-red-300"}`}
          >
            <Trash2 aria-hidden className="size-4" />
            {busy === "delete"
              ? "Deleting…"
              : confirming
                ? "Delete for good"
                : "Delete listen"}
          </button>
          <button
            type="submit"
            disabled={busy !== undefined}
            className="rounded-full bg-teal-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
