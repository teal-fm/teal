import type {
  MusicBrainzArtistCredit,
  MusicBrainzRecording,
} from "./oldStamp";
import type { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/feed/play";

export const PLAY_COLLECTION = "fm.teal.feed.play";
export const FALLBACK_DURATION_SECONDS = 180;
export const SUBMISSION_CLIENT_AGENT = "teal.amethyst/1.0.0";

const MUSICBRAINZ_BASE_URL = "https://musicbrainz.org/ws/2";
const MUSICBRAINZ_USER_AGENT =
  "teal.amethyst/1.0.0 (https://teal.fm; manual listens)";
const MUSICBRAINZ_RATE_LIMIT_MS = 1100;

export type ListenTimestampMode = "now" | "custom";

export type MusicBrainzAlbumRelease = {
  id: string;
  title: string;
  artistCredit?: MusicBrainzArtistCredit[];
  date?: string;
  country?: string;
  status?: string;
  trackCount?: number;
  media?: MusicBrainzMedium[];
};

export type MusicBrainzMedium = {
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
    body: unknown,
  ) => Promise<{ data: unknown }>;
};

let lastMusicBrainzRequestAt = 0;
let musicBrainzQueue = Promise.resolve();

function normalizeArtistCredit(
  credit?: MusicBrainzArtistCredit[],
): MusicBrainzArtistCredit[] | undefined {
  if (!credit || credit.length === 0) return undefined;
  return credit;
}

function artistCreditFromApi(value: unknown): MusicBrainzArtistCredit[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const credits = value.filter(
    (credit): credit is MusicBrainzArtistCredit =>
      !!credit &&
      typeof credit === "object" &&
      "artist" in credit &&
      !!credit.artist &&
      typeof credit.artist === "object" &&
      typeof credit.artist.id === "string" &&
      typeof credit.artist.name === "string",
  );

  return credits.length > 0 ? credits : undefined;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseRelease(value: unknown): MusicBrainzAlbumRelease | undefined {
  if (!value || typeof value !== "object") return undefined;
  const release = value as Record<string, unknown>;
  if (typeof release.id !== "string" || typeof release.title !== "string") {
    return undefined;
  }

  return {
    id: release.id,
    title: release.title,
    artistCredit: artistCreditFromApi(release["artist-credit"]),
    date: asOptionalString(release.date),
    country: asOptionalString(release.country),
    status: asOptionalString(release.status),
    trackCount: asOptionalNumber(release["track-count"]),
  };
}

function parseAlbumTrack(value: unknown, index: number): MusicBrainzAlbumTrack | undefined {
  if (!value || typeof value !== "object") return undefined;
  const track = value as Record<string, unknown>;
  const recording = track.recording;
  if (!recording || typeof recording !== "object") return undefined;

  const parsedRecording = recording as Record<string, unknown>;
  if (
    typeof parsedRecording.id !== "string" ||
    typeof parsedRecording.title !== "string"
  ) {
    return undefined;
  }

  const recordingWithCredits: MusicBrainzRecording = {
    id: parsedRecording.id,
    title: parsedRecording.title,
    length: asOptionalNumber(parsedRecording.length),
    isrcs: Array.isArray(parsedRecording.isrcs)
      ? parsedRecording.isrcs.filter(
          (isrc): isrc is string => typeof isrc === "string",
        )
      : undefined,
    "artist-credit": artistCreditFromApi(parsedRecording["artist-credit"]),
  };

  return {
    key: `${asOptionalString(track.number) || index + 1}:${parsedRecording.id}`,
    id: asOptionalString(track.id),
    position: asOptionalNumber(track.position),
    number: asOptionalString(track.number),
    title: asOptionalString(track.title),
    length: asOptionalNumber(track.length),
    recording: recordingWithCredits,
  };
}

function parseReleaseDetails(value: unknown): MusicBrainzAlbumRelease {
  const parsed = parseRelease(value);
  if (!parsed) throw new Error("MusicBrainz returned an invalid release.");

  const rawRelease = value as Record<string, unknown>;
  const media = Array.isArray(rawRelease.media)
    ? rawRelease.media.flatMap((mediumValue, mediumIndex) => {
        if (!mediumValue || typeof mediumValue !== "object") return [];
        const medium = mediumValue as Record<string, unknown>;
        const tracks = Array.isArray(medium.tracks)
          ? medium.tracks
              .map((track, index) => parseAlbumTrack(track, index))
              .filter((track): track is MusicBrainzAlbumTrack => !!track)
          : [];
        return [
          {
            position: asOptionalNumber(medium.position) || mediumIndex + 1,
            title: asOptionalString(medium.title),
            trackCount: asOptionalNumber(medium["track-count"]),
            tracks,
          },
        ];
      })
    : [];

  return { ...parsed, media };
}

function releaseSearchResults(value: unknown): MusicBrainzAlbumRelease[] {
  if (!value || typeof value !== "object") return [];
  const releases = (value as Record<string, unknown>).releases;
  if (!Array.isArray(releases)) return [];
  return releases
    .map(parseRelease)
    .filter((release): release is MusicBrainzAlbumRelease => !!release);
}

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

async function musicBrainzJson(url: string): Promise<unknown> {
  const request = musicBrainzQueue.then(async () => {
    await waitForMusicBrainzTurn();

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": MUSICBRAINZ_USER_AGENT },
        });
        if (response.status === 503 && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
          continue;
        }
        if (!response.ok) {
          throw new Error(`MusicBrainz request failed with ${response.status}.`);
        }
        return response.json();
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("MusicBrainz request failed.");
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
  const value = await musicBrainzJson(`${MUSICBRAINZ_BASE_URL}/release?${params}`);
  return releaseSearchResults(value);
}

export async function getMusicBrainzRelease(
  releaseId: string,
): Promise<MusicBrainzAlbumRelease> {
  const params = new URLSearchParams({
    inc: "recordings+artist-credits+isrcs",
    fmt: "json",
  });
  const value = await musicBrainzJson(
    `${MUSICBRAINZ_BASE_URL}/release/${encodeURIComponent(releaseId)}?${params}`,
  );
  return parseReleaseDetails(value);
}

export function normalizeMbid(value?: string) {
  if (!value) return undefined;
  return value.startsWith("mbid:") ? value : `mbid:${value}`;
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
  return (normalizeArtistCredit(credits) || [])
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

  const timestamps: Date[] = new Array(tracks.length);
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
    duration: recording.length ? Math.floor(recording.length / 1000) : undefined,
    artists,
    releaseName: release?.title,
    releaseMbId: normalizeMbid(release?.id),
    isrc: recording.isrcs?.[0],
    musicServiceUri: "local",
    submissionClientAgent: SUBMISSION_CLIENT_AGENT,
    playedTime,
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
    musicServiceUri: "local",
    submissionClientAgent: SUBMISSION_CLIENT_AGENT,
    playedTime,
  };
}

export function buildManualListenRecords(
  release: MusicBrainzAlbumRelease,
  tracks: MusicBrainzAlbumTrack[],
  mode: ListenTimestampMode,
  customStart?: Date,
  now = new Date(),
) {
  return buildListenTimeline(tracks, mode, customStart, now).map(({ track, playedTime }) =>
    createPlayRecordFromAlbumTrack(release, track, playedTime),
  );
}

export async function submitManualListenRecords(
  agent: ManualListenAgent,
  records: PlayRecord[],
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

  const results = (response.data as { results?: unknown[] }).results;
  return Array.isArray(results) && results.length > 0 ? results.length : records.length;
}
