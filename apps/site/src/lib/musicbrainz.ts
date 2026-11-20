/**
 * MusicBrainz lookups for linking a play to its recording, release and
 * artists. The web service is CORS-open, so the browser calls it directly and
 * each person's searches count against their own IP's rate limit (one request
 * a second), which requests here are spaced to respect.
 */

import { duration } from "./format";

const API = "https://musicbrainz.org/ws/2";

export type MbKind = "recording" | "release" | "artist";

export interface MbCredit {
  name: string;
  id: string;
}

/** A search result or lookup, flattened for display. */
export interface MbEntity {
  kind: MbKind;
  id: string;
  name: string;
  disambiguation?: string;
  /** Shown under the name, joined with " · ". */
  details: string[];
  /** Recordings and releases: who they're credited to. */
  artists?: MbCredit[];
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BARE = new RegExp(`^(?:mbid:)?(${UUID})$`, "i");
const LINK = new RegExp(
  `^(?:https?://)?(?:[a-z]+\\.)?musicbrainz\\.org/([a-z-]+)/(${UUID})(?:[/?#].*)?$`,
  "i",
);

/**
 * An MBID typed or pasted into a search box: bare, as `mbid:<uuid>`, or as a
 * musicbrainz.org link, which also says what kind of entity it is.
 */
export function parseMbid(
  text: string,
): { id: string; kind?: string } | undefined {
  const value = text.trim();
  const bare = BARE.exec(value);
  if (bare) return { id: bare[1].toLowerCase() };
  const link = LINK.exec(value);

  return link
    ? { id: link[2].toLowerCase(), kind: link[1].toLowerCase() }
    : undefined;
}

/** Thrown when MusicBrainz has nothing at that ID. */
export class MbNotFound extends Error {}

let nextSlot = 0;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function get<T>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams({ ...params, fmt: "json" });
  for (let attempt = 0; ; attempt++) {
    // Requests start a little over a second apart.
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + 1100;
    if (wait > 0) await sleep(wait, signal);

    const response = await fetch(`${API}/${path}?${query}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (response.ok) return (await response.json()) as T;
    if (response.status === 404 || response.status === 400)
      throw new MbNotFound();
    // 503 means slow down, or that MusicBrainz is busy for everyone.
    if (response.status === 503 && attempt < 2) {
      await sleep(1500 * (attempt + 1), signal);
      continue;
    }
    throw new Error(
      response.status === 503
        ? "MusicBrainz is busy. Try again in a moment."
        : `MusicBrainz couldn't answer (${response.status}).`,
    );
  }
}

// What the web service returns, as far as it's read here.
interface RawCredit {
  name: string;
  joinphrase?: string;
  artist: { id: string; name: string };
}
interface RawRelease {
  id: string;
  title: string;
  disambiguation?: string;
  date?: string;
  country?: string;
  status?: string;
  "artist-credit"?: RawCredit[];
  "release-group"?: { "primary-type"?: string };
  media?: { format?: string; "track-count"?: number }[];
}
interface RawRecording {
  id: string;
  title: string;
  disambiguation?: string;
  length?: number | null;
  "first-release-date"?: string;
  "artist-credit"?: RawCredit[];
  releases?: RawRelease[];
}
interface RawArtist {
  id: string;
  name: string;
  disambiguation?: string;
  type?: string;
  country?: string;
  area?: { name?: string };
  "life-span"?: { begin?: string; end?: string };
}

const credited = (credits?: RawCredit[]) =>
  credits?.map((credit) => `${credit.name}${credit.joinphrase ?? ""}`).join("");

const creditsOf = (credits?: RawCredit[]): MbCredit[] | undefined =>
  credits?.map((credit) => ({ name: credit.name, id: credit.artist.id }));

const present = (values: (string | false | undefined | null)[]) =>
  values.filter((value): value is string => !!value);

function recordingOf(raw: RawRecording): MbEntity {
  const releases = raw.releases ?? [];
  const more = releases.length > 1 ? ` + ${releases.length - 1} more` : "";

  return {
    kind: "recording",
    id: raw.id,
    name: raw.title,
    disambiguation: raw.disambiguation || undefined,
    artists: creditsOf(raw["artist-credit"]),
    details: present([
      credited(raw["artist-credit"]),
      raw.length ? duration(raw.length / 1000) : undefined,
      releases[0] && `${releases[0].title}${more}`,
      raw["first-release-date"]?.slice(0, 4),
    ]),
  };
}

function formatsOf(media: RawRelease["media"] = []) {
  const formats = [
    ...new Set(media.map((medium) => medium.format).filter(Boolean)),
  ];
  const tracks = media.reduce(
    (sum, medium) => sum + (medium["track-count"] ?? 0),
    0,
  );

  return present([
    formats.join(" + "),
    tracks > 0 && `${tracks} track${tracks === 1 ? "" : "s"}`,
  ]);
}

function releaseOf(raw: RawRelease): MbEntity {
  return {
    kind: "release",
    id: raw.id,
    name: raw.title,
    disambiguation: raw.disambiguation || undefined,
    artists: creditsOf(raw["artist-credit"]),
    details: present([
      credited(raw["artist-credit"]),
      raw["release-group"]?.["primary-type"],
      raw.date,
      raw.country,
      ...formatsOf(raw.media),
      raw.status && raw.status !== "Official" && raw.status,
    ]),
  };
}

function artistOf(raw: RawArtist): MbEntity {
  const span = raw["life-span"];
  const years = span?.begin
    ? `${span.begin.slice(0, 4)}–${span.end?.slice(0, 4) ?? ""}`
    : undefined;

  return {
    kind: "artist",
    id: raw.id,
    name: raw.name,
    disambiguation: raw.disambiguation || undefined,
    details: present([raw.type, raw.area?.name ?? raw.country, years]),
  };
}

const LIMIT = "10";

/** A plain-text search, like the website's basic search box. */
export async function search(
  kind: MbKind,
  text: string,
  signal?: AbortSignal,
): Promise<MbEntity[]> {
  const params = { query: text, dismax: "true", limit: LIMIT };
  switch (kind) {
    case "recording": {
      const body = await get<{ recordings: RawRecording[] }>(
        "recording",
        params,
        signal,
      );
      return body.recordings.map(recordingOf);
    }
    case "release": {
      const body = await get<{ releases: RawRelease[] }>(
        "release",
        params,
        signal,
      );
      return body.releases.map(releaseOf);
    }
    case "artist": {
      const body = await get<{ artists: RawArtist[] }>(
        "artist",
        params,
        signal,
      );
      return body.artists.map(artistOf);
    }
  }
}

const INCLUDES: Record<MbKind, string> = {
  recording: "artist-credits releases",
  release: "artist-credits media release-groups",
  artist: "",
};

/** One entity by its MBID; throws MbNotFound when there's no such one. */
export async function lookup(
  kind: MbKind,
  id: string,
  signal?: AbortSignal,
): Promise<MbEntity> {
  const params: Record<string, string> = INCLUDES[kind]
    ? { inc: INCLUDES[kind] }
    : {};
  switch (kind) {
    case "recording":
      return recordingOf(
        await get<RawRecording>(`recording/${id}`, params, signal),
      );
    case "release":
      return releaseOf(await get<RawRelease>(`release/${id}`, params, signal));
    case "artist":
      return artistOf(await get<RawArtist>(`artist/${id}`, params, signal));
  }
}

/** The releases a recording appears on, or that belong to a release group. */
export async function releasesOf(
  by: "recording" | "release-group",
  id: string,
  signal?: AbortSignal,
): Promise<MbEntity[]> {
  const body = await get<{ releases: RawRelease[] }>(
    "release",
    { [by]: id, inc: "artist-credits media release-groups", limit: "50" },
    signal,
  );

  return body.releases.map(releaseOf);
}

/** Recordings with this ISRC; usually one, which is a strong match for a play. */
export async function recordingsByIsrc(
  isrc: string,
  signal?: AbortSignal,
): Promise<MbEntity[]> {
  try {
    const body = await get<{ recordings: RawRecording[] }>(
      `isrc/${encodeURIComponent(isrc.trim().toUpperCase())}`,
      { inc: "artist-credits releases" },
      signal,
    );
    return body.recordings.map(recordingOf);
  } catch (error) {
    if (error instanceof MbNotFound) return [];
    throw error;
  }
}

export const mbUrl = (kind: MbKind, id: string) =>
  `https://musicbrainz.org/${kind}/${id}`;
