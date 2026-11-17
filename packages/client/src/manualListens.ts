import type { ComAtprotoRepoApplyWrites } from "@atproto/api";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";
import { z } from "zod";

import type { MusicBrainzArtistCredit, MusicBrainzRecording } from "./oldStamp";
import {
  lenientArray,
  optionalNumber,
  optionalString,
  toDatetimeString,
} from "./schema";
import type { ConfirmedListenWrite } from "./teal/pendingListens";

export const PLAY_COLLECTION = "fm.teal.feed.play";
export const FALLBACK_DURATION_SECONDS = 180;
export const SUBMISSION_CLIENT_AGENT = "teal.amethyst/1.0.0";

const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";

const MUSICBRAINZ_USER_AGENT =
  "teal.amethyst/1.0.0 (https://teal.fm; manual listens)";

const MUSICBRAINZ_RATE_LIMIT_MS = 1100;
const MUSICBRAINZ_TIMEOUT_MS = 15_000;

export type ListenTimestampMode = "now" | "custom";

export type MusicBrainzAlbumRelease = {
  id: string;
  title: string;
  artistCredit?: MusicBrainzArtistCredit[];
  date?: string;
  country?: string;
  status?: string;
  disambiguation?: string;
  trackCount?: number;
  media?: MusicBrainzMedium[];
};

export type MusicBrainzMedium = {
  format?: string;
  position?: number;
  title?: string;
  trackCount?: number;
  tracks?: MusicBrainzAlbumTrack[];
};

export type MusicBrainzAlbumTrack = {
  key: string;
  id?: string;
  position?: number;
  number?: string;
  title?: string;
  length?: number;
  recording: MusicBrainzRecording;
};

export type ListenTimelineItem = {
  track: MusicBrainzAlbumTrack;
  playedTime: string;
};

export type ManualListenAgent = {
  did?: string;
  call: (
    method: string,
    params: Record<string, never>,
    body: ComAtprotoRepoApplyWrites.InputSchema,
  ) => Promise<{ data: unknown; success?: boolean }>;
};

let lastMusicBrainzRequestAt = 0;
let musicBrainzQueue = Promise.resolve();

const artistCreditSchema = z.object({
  artist: z.object({
    id: z.string(),
    name: z.string(),
    "sort-name": optionalString,
  }),
  joinphrase: optionalString,
  name: z.string().catch(""),
});

const artistCreditsSchema = lenientArray(artistCreditSchema).transform(
  (credits) => (credits && credits.length > 0 ? credits : undefined),
);

const recordingSchema = z.object({
  id: z.string(),
  title: z.string(),
  length: optionalNumber,
  isrcs: lenientArray(z.string()),
  "artist-credit": artistCreditsSchema,
});

const albumTrackSchema = z.object({
  id: optionalString,
  position: optionalNumber,
  number: optionalString,
  title: optionalString,
  length: optionalNumber,
  recording: recordingSchema,
});

/** Keys each track by its position in MusicBrainz's raw list, so a dropped malformed entry does not renumber the rest. */
const albumTracksSchema = z.unknown().transform((value) =>
  Array.isArray(value)
    ? value.flatMap((item, index): MusicBrainzAlbumTrack[] => {
        const parsed = albumTrackSchema.safeParse(item);

        if (!parsed.success) return [];

        return [
          {
            ...parsed.data,
            key: `${parsed.data.number || index + 1}:${parsed.data.recording.id}`,
          },
        ];
      })
    : undefined,
);

const mediumSchema = z.object({
  position: optionalNumber,
  title: optionalString,
  format: optionalString,
  "track-count": optionalNumber,
  tracks: albumTracksSchema,
});

const releaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  "artist-credit": artistCreditsSchema,
  date: optionalString,
  country: optionalString,
  status: optionalString,
  disambiguation: optionalString,
  "track-count": optionalNumber,
  media: lenientArray(mediumSchema),
});

function releaseSummary(
  release: z.output<typeof releaseSchema>,
): MusicBrainzAlbumRelease {
  return {
    id: release.id,
    title: release.title,
    artistCredit: release["artist-credit"],
    date: release.date,
    country: release.country,
    status: release.status,
    disambiguation: release.disambiguation,
    trackCount: release["track-count"],
    media: release.media?.map((medium) => ({
      format: medium.format,
      trackCount: medium["track-count"],
    })),
  };
}

const releaseSearchSchema = z.object({
  releases: lenientArray(releaseSchema.transform(releaseSummary)),
});

const releaseDetailsSchema = releaseSchema.transform(
  (release): MusicBrainzAlbumRelease => ({
    ...releaseSummary(release),
    media: (release.media ?? []).map((medium, mediumIndex) => ({
      position: medium.position || mediumIndex + 1,
      title: medium.title,
      format: medium.format,
      trackCount: medium["track-count"],
      tracks: medium.tracks ?? [],
    })),
  }),
);

const applyWritesReceiptSchema = z.object({ uri: z.string(), cid: z.string() });

const applyWritesResponseSchema = z
  .object({ results: z.array(z.unknown()).optional().catch(undefined) })
  .catch({ results: undefined });

function escapeMusicBrainzQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function waitForMusicBrainzTurn() {
  const elapsed = Date.now() - lastMusicBrainzRequestAt;

  if (lastMusicBrainzRequestAt > 0 && elapsed < MUSICBRAINZ_RATE_LIMIT_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MUSICBRAINZ_RATE_LIMIT_MS - elapsed),
    );
  }

  lastMusicBrainzRequestAt = Date.now();
}

/** Fetches a MusicBrainz URL, retrying 503s and network errors with backoff. */
async function fetchMusicBrainz(url: string): Promise<Response> {
  let lastError: Error = new Error("MusicBrainz request failed.");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      MUSICBRAINZ_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
        signal: controller.signal,
      });

      if (response.status === 503 && attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(`MusicBrainz request failed with ${response.status}.`);
      }

      return response;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("MusicBrainz timed out. Please try again.");
      }

      if (error instanceof Error) lastError = error;

      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function musicBrainzJson<T>(
  url: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const request = musicBrainzQueue.then(async () => {
    await waitForMusicBrainzTurn();

    const response = await fetchMusicBrainz(url);
    const body = schema.safeParse(await response.json());

    if (!body.success) {
      throw new Error("MusicBrainz returned an unexpected response.");
    }

    return body.data;
  });

  musicBrainzQueue = request.then(
    () => undefined,
    () => undefined,
  );

  return request;
}

export async function searchMusicBrainzReleases(
  album: string,
  artist?: string,
): Promise<MusicBrainzAlbumRelease[]> {
  const queryParts = [`release:"${escapeMusicBrainzQuery(album.trim())}"`];

  if (artist?.trim()) {
    queryParts.push(`artist:"${escapeMusicBrainzQuery(artist.trim())}"`);
  }

  const params = new URLSearchParams({
    query: queryParts.join(" AND "),
    fmt: "json",
    limit: "20",
    inc: "artist-credits",
  });

  const { releases } = await musicBrainzJson(
    `${MUSICBRAINZ_BASE_URL}/release?${params}`,
    releaseSearchSchema,
  );

  return releases ?? [];
}

export async function getMusicBrainzRelease(
  releaseId: string,
): Promise<MusicBrainzAlbumRelease> {
  const params = new URLSearchParams({
    inc: "recordings+artist-credits+isrcs",
    fmt: "json",
  });

  return musicBrainzJson(
    `${MUSICBRAINZ_BASE_URL}/release/${encodeURIComponent(releaseId)}?${params}`,
    releaseDetailsSchema,
  );
}

export function normalizeMbid(value?: string): `mbid:${string}` | undefined {
  if (!value) return undefined;

  return `mbid:${value.replace(/^mbid:/, "")}`;
}

export function effectiveDurationSeconds(track: MusicBrainzAlbumTrack) {
  const milliseconds = track.length ?? track.recording.length;

  if (!milliseconds || milliseconds <= 0) return FALLBACK_DURATION_SECONDS;

  return Math.max(1, Math.floor(milliseconds / 1000));
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function artistsFromCredits(credits?: MusicBrainzArtistCredit[]) {
  return (credits ?? [])
    .map((credit) => ({
      artistName: credit.name || credit.artist.name,
      artistMbId: normalizeMbid(credit.artist.id),
    }))
    .filter((artist) => artist.artistName);
}

export function buildListenTimeline(
  tracks: MusicBrainzAlbumTrack[],
  mode: ListenTimestampMode,
  customStart?: Date,
  now = new Date(),
): ListenTimelineItem[] {
  if (tracks.length === 0) return [];

  const timestamps: Date[] = [];

  if (mode === "now") {
    let cursor = now.getTime();

    for (let index = tracks.length - 1; index >= 0; index -= 1) {
      timestamps[index] = new Date(cursor);

      if (index > 0) {
        cursor -= effectiveDurationSeconds(tracks[index - 1]) * 1000;
      }
    }
  } else {
    if (!customStart || Number.isNaN(customStart.getTime())) {
      throw new Error("Choose a valid starting date and time.");
    }

    let cursor = customStart.getTime();

    for (let index = 0; index < tracks.length; index += 1) {
      timestamps[index] = new Date(cursor);
      cursor += effectiveDurationSeconds(tracks[index]) * 1000;
    }
  }

  return tracks.map((track, index) => ({
    track,
    playedTime: timestamps[index].toISOString(),
  }));
}

export function createPlayRecordFromRecording(
  recording: MusicBrainzRecording,
  playedTime = new Date().toISOString(),
): PlayRecord {
  const release = recording.selectedRelease;
  const artists = artistsFromCredits(recording["artist-credit"]);

  return {
    $type: PLAY_COLLECTION,
    trackName: recording.title,
    recordingMbId: normalizeMbid(recording.id),
    trackMbId: normalizeMbid(recording.id),
    duration: recording.length
      ? Math.floor(recording.length / 1000)
      : undefined,
    artists,
    releaseName: release?.title,
    releaseMbId: normalizeMbid(release?.id),
    isrc: recording.isrcs?.[0],
    musicServiceUri: "local:manual",
    submissionClientAgent: SUBMISSION_CLIENT_AGENT,
    playedTime: toDatetimeString(new Date(playedTime)),
  };
}

export function createPlayRecordFromAlbumTrack(
  release: MusicBrainzAlbumRelease,
  track: MusicBrainzAlbumTrack,
  playedTime: string,
): PlayRecord {
  const recording = track.recording;

  const artists = artistsFromCredits(
    recording["artist-credit"] || release.artistCredit,
  );

  const durationMilliseconds = track.length ?? recording.length;

  return {
    $type: PLAY_COLLECTION,
    trackName: recording.title || track.title || "Unknown track",
    recordingMbId: normalizeMbid(recording.id),
    trackMbId: normalizeMbid(recording.id),
    duration: durationMilliseconds
      ? Math.floor(durationMilliseconds / 1000)
      : undefined,
    artists,
    releaseName: release.title,
    releaseMbId: normalizeMbid(release.id),
    isrc: recording.isrcs?.[0],
    musicServiceUri: "local:manual",
    submissionClientAgent: SUBMISSION_CLIENT_AGENT,
    playedTime: toDatetimeString(new Date(playedTime)),
  };
}

export function buildManualListenRecords(
  release: MusicBrainzAlbumRelease,
  tracks: MusicBrainzAlbumTrack[],
  mode: ListenTimestampMode,
  customStart?: Date,
  now = new Date(),
) {
  return buildListenTimeline(tracks, mode, customStart, now).map(
    ({ track, playedTime }) =>
      createPlayRecordFromAlbumTrack(release, track, playedTime),
  );
}

export async function submitManualListenRecords(
  agent: ManualListenAgent,
  records: PlayRecord[],
  onSaved?: (writes: ConfirmedListenWrite[]) => void,
) {
  if (records.length === 0) throw new Error("Select at least one track.");

  if (!agent.did) throw new Error("Your repository is not ready.");

  const response = await agent.call(
    "com.atproto.repo.applyWrites",
    {},
    {
      repo: agent.did,
      writes: records.map((record) => ({
        $type: "com.atproto.repo.applyWrites#create",
        collection: PLAY_COLLECTION,
        value: record,
      })),
    },
  );

  if (response.success === false)
    throw new Error("Could not save these listens. Try again.");

  const { results } = applyWritesResponseSchema.parse(response.data);

  if (results && onSaved) {
    const confirmed = results.flatMap((result, index) => {
      const receipt = applyWritesReceiptSchema.safeParse(result);

      return receipt.success && records[index]
        ? [{ record: records[index], uri: receipt.data.uri, cid: receipt.data.cid }]
        : [];
    });

    try {
      onSaved(confirmed);
    } catch {
      // A local readback cache must never turn a completed write into a retry.
      console.warn("Listens saved, but local pending-listen retention failed.");
    }
  }

  return results && results.length > 0
    ? results.length
    : records.length;
}

/** A `datetime-local` style value for now, in local time. */
export function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDateTime(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function releaseArtist(release: MusicBrainzAlbumRelease) {
  return release.artistCredit?.map((credit) => credit.name || credit.artist.name).join(", ") || "Unknown artist";
}

/** Date, country, format, and status: enough to tell editions of an album apart. */
export function releaseDetails(release: MusicBrainzAlbumRelease) {
  const formats = [...new Set(release.media?.map((medium) => medium.format).filter(Boolean))].join(" + ");

  return [release.date, release.country, formats, release.status, release.disambiguation].filter(Boolean).join(" · ");
}

export function flattenTracks(release: MusicBrainzAlbumRelease) {
  return (release.media || []).flatMap((medium) => medium.tracks || []);
}
