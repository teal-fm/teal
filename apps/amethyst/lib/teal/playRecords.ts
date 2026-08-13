import type { Agent } from "@atproto/api";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/feed/defs";
import type { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/feed/play";

export const PLAY_COLLECTION = "fm.teal.feed.play";

export type EditablePlayRecord = Pick<
  PlayRecord,
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
> &
  Record<string, unknown>;

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

  let playedTime: string | undefined;
  const playedTimeText = fields.playedTime.trim();
  if (playedTimeText) {
    const parsed = new Date(playedTimeText);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Played time must be a valid date and time.");
    }
    playedTime = parsed.toISOString();
  }

  return {
    ...current,
    $type: PLAY_COLLECTION,
    trackName,
    artists: artistsFromText(fields.artistsText),
    releaseName: optionalTrim(fields.releaseName),
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
  await agent.call(
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
}

export async function deletePlayRecord(agent: Agent, did: string, rkey: string) {
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
