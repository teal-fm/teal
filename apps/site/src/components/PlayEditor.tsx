import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { useAuth } from "~/lib/auth";
import type { Play } from "~/lib/types";

const field =
  "w-full rounded-lg border border-neutral-400/30 bg-white/70 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/20 dark:bg-gray-950/60";
const label = "mb-1 block text-sm font-medium";

/**
 * Edits or deletes one of the signed-in person's plays. `onDone` gets the
 * edited play, or null once it's deleted.
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
  const [artists, setArtists] = useState(
    play.artists.length > 0 ? play.artists : [""],
  );
  const [releaseName, setReleaseName] = useState(play.releaseName ?? "");
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
    const edited = {
      trackName: trackName.trim(),
      artists: artists.map((name) => name.trim()).filter(Boolean),
      releaseName: releaseName.trim() || undefined,
    };
    void run("save", async () => {
      await call("fm.teal.site.updatePlay", { uri: play.uri, ...edited });
      onDone({ ...play, ...edited });
    });
  }

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

  const setArtist = (index: number, name: string) =>
    setArtists(artists.map((other, i) => (i === index ? name : other)));

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="play-editor-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-neutral-400/20 bg-white p-0 text-neutral-800 shadow-2xl backdrop:bg-gray-950/50 backdrop:backdrop-blur-sm dark:bg-gray-900 dark:text-white"
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
        </div>

        <fieldset>
          <legend className={label}>Artists</legend>
          <div className="flex flex-col gap-2">
            {artists.map((name, index) => (
              <div key={index} className="flex gap-2">
                <input
                  aria-label={`Artist ${index + 1}`}
                  maxLength={256}
                  value={name}
                  onChange={(event) => setArtist(index, event.target.value)}
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
            ))}
          </div>
          {artists.length < 32 && (
            <button
              type="button"
              onClick={() => setArtists([...artists, ""])}
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
