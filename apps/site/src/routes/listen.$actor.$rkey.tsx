import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Pencil } from "lucide-react";

import { Avatar } from "~/components/Avatar";
import { Card } from "~/components/Card";
import { Cover } from "~/components/Cover";
import { Header } from "~/components/Header";
import { PlayEditor } from "~/components/PlayEditor";
import { getListen } from "~/lib/api";
import { useOwns } from "~/lib/auth";
import {
  coverUrl,
  displayName,
  duration,
  mbid,
  profilePath,
  timeAgo,
} from "~/lib/format";
import type { Play } from "~/lib/types";

export const Route = createFileRoute("/listen/$actor/$rkey")({
  loader: ({ params }) =>
    getListen({ data: { actor: params.actor, rkey: params.rkey } }),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Listen · teal.fm" }] };
    const { play, profile } = loaderData;
    const title = [play.trackName, play.artists.join(", ")]
      .filter(Boolean)
      .join(" by ");
    const when = play.playedTime
      ? ` on ${new Date(play.playedTime).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}`
      : "";
    const description = `${displayName(profile, profile.did)} listened${when}${play.releaseName ? `, from ${play.releaseName}` : ""}.`;
    const image = coverUrl(play.releaseMbId, 500);

    return {
      meta: [
        { title: `${title} · teal.fm` },
        { name: "description", content: description },
        { property: "og:type", content: "music.song" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:card", content: "summary" },
            ]
          : []),
      ],
    };
  },
  component: ListenPage,
});

const FULL_DATE: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
};

/** A full date and time: UTC from the server, then the viewer's own zone once hydrated. */
function LocalTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const [text, setText] = useState(
    () => `${date.toLocaleString("en", { ...FULL_DATE, timeZone: "UTC" })} UTC`,
  );
  useEffect(
    () => setText(new Date(iso).toLocaleString(undefined, FULL_DATE)),
    [iso],
  );

  return <time dateTime={iso}>{text}</time>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-neutral-500 dark:text-teal-100/50">
        {label}
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-teal-700 hover:underline dark:text-teal-300"
    >
      {children}
    </a>
  );
}

/** "open.spotify.com" from a link; undefined when it isn't one. */
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function Details({ play }: { play: Play }) {
  const recording = mbid(play.recordingMbId);
  const release = mbid(play.releaseMbId);
  const artists = play.artists.flatMap((name, i) => {
    const id = mbid(play.artistMbIds?.[i]);
    return id ? [{ name, id }] : [];
  });

  return (
    <dl className="divide-y divide-neutral-400/15">
      {play.playedTime && (
        <Detail label="Played">
          <LocalTime iso={play.playedTime} />
        </Detail>
      )}
      {play.duration !== undefined && play.duration > 0 && (
        <Detail label="Length">{duration(play.duration)}</Detail>
      )}
      {play.musicService && (
        <Detail label="Music service">
          {hostOf(play.musicService) ?? play.musicService}
        </Detail>
      )}
      {play.client && <Detail label="Submitted by">{play.client}</Detail>}
      {recording && (
        <Detail label="Recording">
          <External href={`https://musicbrainz.org/recording/${recording}`}>
            MusicBrainz
          </External>
        </Detail>
      )}
      {release && (
        <Detail label="Release">
          <External href={`https://musicbrainz.org/release/${release}`}>
            MusicBrainz
          </External>
        </Detail>
      )}
      {artists.length > 0 && (
        <Detail label={artists.length === 1 ? "Artist" : "Artists"}>
          {artists.map((artist, i) => (
            <span key={`${artist.id}-${i}`}>
              {i > 0 && ", "}
              <External href={`https://musicbrainz.org/artist/${artist.id}`}>
                {artist.name}
              </External>
            </span>
          ))}
        </Detail>
      )}
      <Detail label="Record">
        <a
          href={`https://pdsls.dev/${play.uri}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-sm text-teal-700 hover:underline dark:text-teal-300"
        >
          {play.uri}
        </a>
      </Detail>
    </dl>
  );
}

/** Your own listen gets an edit button; deleting it goes back to your profile. */
function EditListen({
  play,
  handle,
  onChange,
}: {
  play: Play;
  /** Where the listener's profile is, for after a delete. */
  handle: string;
  onChange: (play: Play) => void;
}) {
  const owns = useOwns(play.did);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  if (!owns) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-400/30 px-4 py-1.5 text-sm font-medium transition hover:bg-neutral-500/10"
      >
        <Pencil aria-hidden className="size-3.5" />
        Edit
      </button>
      {editing && (
        <PlayEditor
          play={play}
          onClose={() => setEditing(false)}
          onDone={(next) => {
            setEditing(false);
            if (next) onChange(next);
            else
              void navigate({
                to: "/profile/$handle",
                params: { handle },
              });
          }}
        />
      )}
    </>
  );
}

function ListenPage() {
  const loaded = Route.useLoaderData();
  const { profile } = loaded;
  // An edit shows straight away, before the record cache catches up.
  const [edited, setEdited] = useState<Play>();
  const [source, setSource] = useState(loaded);
  if (source !== loaded) {
    setSource(loaded);
    setEdited(undefined);
  }
  const play = edited ?? loaded.play;
  const name = displayName(profile, profile.did);
  const host = play.originUrl && hostOf(play.originUrl);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <Cover
            key={play.releaseMbId}
            releaseMbId={play.releaseMbId}
            size={192}
          />
          <div className="min-w-0">
            <h1 className="font-display break-words text-3xl font-medium sm:text-4xl">
              {play.trackName}
            </h1>
            <p className="mt-1 break-words text-lg">
              {play.artists.join(", ") || "Unknown artist"}
            </p>
            {play.releaseName && (
              <p className="break-words text-neutral-600 dark:text-teal-100/60">
                {play.releaseName}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
              {play.originUrl && (
                <a
                  href={play.originUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 px-4 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-500/10 dark:text-teal-300"
                >
                  {host ? `Open on ${host}` : "Open"}
                  <ArrowUpRight aria-hidden className="size-4" />
                </a>
              )}
              <EditListen
                play={play}
                handle={profilePath(profile, profile.did)}
                onChange={setEdited}
              />
            </div>
          </div>
        </article>

        <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to="/profile/$handle"
            params={{ handle: profilePath(profile, profile.did) }}
            className="flex min-w-0 items-center gap-2 font-medium hover:underline"
          >
            <Avatar profile={profile} size={28} />
            <span className="truncate">{name}</span>
          </Link>
          <span className="text-neutral-600 dark:text-teal-100/60">
            listened
            {play.playedTime && (
              <>
                {" "}
                <time dateTime={play.playedTime} suppressHydrationWarning>
                  {timeAgo(play.playedTime)}
                </time>
              </>
            )}
          </span>
        </p>

        <div className="mt-4">
          <Card title="Details">
            <Details play={play} />
          </Card>
        </div>
      </main>
    </>
  );
}
