import type { Agent } from "@atproto/api";

import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";

import { toDatetimeString } from "../schema";

export const PLAY_COLLECTION = "fm.teal.feed.play";

/** A play record as loaded for editing. Fields not listed here are kept at runtime and written back as they were. */
export type EditablePlayRecord = Pick<
  PlayRecord,
  | "$type"
  | "trackName"
  | "artists"
  | "releaseName"
  | "playedTime"
  | "recordingMbId"
  | "releaseMbId"
  | "trackMbId"
  | "duration"
  | "isrc"
  | "originUri"
  | "musicServiceUri"
  | "submissionClientAgent"
  | "trackDiscriminant"
  | "releaseDiscriminant"
>;

export type LoadedPlayRecord = {
  record: EditablePlayRecord;
  swapRecord?: string;
};

export function artistTextFromRecord(
  record: Pick<PlayRecord, "artists" | "artistNames">,
) {
  return (
    record.artists
      ?.map((artist) => artist.artistName)
      .filter(Boolean)
      .join(", ") ||
    record.artistNames?.filter(Boolean).join(", ") ||
    ""
  );
}

export function artistTextFromPlay(play: PlayView) {
  return (
    play.artists
      ?.map((artist) => artist.artistName)
      .filter(Boolean)
      .join(", ") || ""
  );
}

export function artistsFromText(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((artistName) => ({ artistName }));
}

function optionalTrim(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

export function editableRecordFromPlay(play: PlayView): EditablePlayRecord {
  return {
    $type: PLAY_COLLECTION,
    trackName: play.trackName,
    artists: play.artists,
    releaseName: play.releaseName,
    playedTime: play.playedTime,
    recordingMbId: play.recordingMbId,
    releaseMbId: play.releaseMbId,
    trackMbId: play.trackMbId,
    duration: play.duration,
    isrc: play.isrc,
    originUri: play.originUri,
    musicServiceUri: play.musicServiceUri,
    submissionClientAgent: play.submissionClientAgent,
  };
}

/**
 * Applies changed names to a record. A renamed track or release no longer
 * matches its MusicBrainz IDs, so those are cleared rather than left pointing at
 * the old recording or release (which would also attach the new name to it).
 * Artists whose names are unchanged keep their MBIDs.
 */
export function withEditedIdentity(
  current: EditablePlayRecord,
  changes: Partial<Pick<EditablePlayRecord, "trackName" | "releaseName" | "artists">>,
): EditablePlayRecord {
  const next: EditablePlayRecord = { ...current, ...changes };

  if (changes.artists) {
    next.artists = changes.artists.map(
      (artist) => current.artists?.find((existing) => existing.artistName === artist.artistName) ?? artist,
    );
  }

  if (changes.trackName !== undefined && changes.trackName !== current.trackName) {
    next.recordingMbId = undefined;
    next.trackMbId = undefined;
    next.isrc = undefined;
    next.trackDiscriminant = undefined;
  }

  if ("releaseName" in changes && changes.releaseName !== current.releaseName) {
    next.releaseMbId = undefined;
    next.releaseDiscriminant = undefined;
  }

  return next;
}

export function applyEditableFields(
  current: EditablePlayRecord,
  fields: {
    trackName: string;
    artistsText: string;
    releaseName: string;
    playedTime: string;
  },
): EditablePlayRecord {
  const trackName = fields.trackName.trim();

  if (!trackName) {
    throw new Error("Track name is required.");
  }

  let playedTime: PlayRecord["playedTime"];
  const playedTimeText = fields.playedTime.trim();

  if (playedTimeText) {
    const parsed = new Date(playedTimeText);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Played time must be a valid date and time.");
    }

    playedTime = toDatetimeString(parsed);
  }

  return {
    ...withEditedIdentity(current, {
      trackName,
      artists: artistsFromText(fields.artistsText),
      releaseName: optionalTrim(fields.releaseName),
    }),
    $type: PLAY_COLLECTION,
    playedTime,
  };
}

export async function loadPlayRecord(
  agent: Agent,
  did: string,
  rkey: string,
  fallback?: PlayView,
): Promise<LoadedPlayRecord> {
  try {
    const response = await agent.call("com.atproto.repo.getRecord", {
      repo: did,
      collection: PLAY_COLLECTION,
      rkey,
    });

    return {
      // SAFETY: getRecord on fm.teal.feed.play returns a play record; fields this
      // client doesn't edit are written back unchanged.
      record: response.data.value as EditablePlayRecord,
      swapRecord: response.data.cid,
    };
  } catch (error) {
    if (!fallback) throw error;

    return { record: editableRecordFromPlay(fallback) };
  }
}

export async function putPlayRecord(
  agent: Agent,
  did: string,
  rkey: string,
  record: EditablePlayRecord,
  swapRecord?: string,
) {
  const response = await agent.call(
    "com.atproto.repo.putRecord",
    {},
    {
      repo: did,
      collection: PLAY_COLLECTION,
      rkey,
      record,
      swapRecord,
    },
  );

  return { uri: response.data.uri, cid: response.data.cid };
}

export async function deletePlayRecord(
  agent: Agent,
  did: string,
  rkey: string,
) {
  await agent.call(
    "com.atproto.repo.deleteRecord",
    {},
    {
      repo: did,
      collection: PLAY_COLLECTION,
      rkey,
    },
  );
}
