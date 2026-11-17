import { RichText, type Agent } from "@atproto/api";

import type { SocialPlaylistItemView, SocialPlaylistView } from "./api";
import type { TrackViewLike } from "./social";

/** A playlist item's track, with artists in both the list and parallel-array forms the lexicon allows. */
export function toTrackRecord(track: TrackViewLike) {
  const artists =
    track.artists?.map((artist, index) => ({
      artistName: artist.artistName || artist.name || track.artistNames?.[index] || "Unknown artist",
      artistMbId: artist.artistMbId || artist.mbid || track.artistMbIds?.[index],
    })) ||
    track.artistNames?.map((artistName, index) => ({ artistName, artistMbId: track.artistMbIds?.[index] })) ||
    [];

  return {
    trackName: track.trackName?.trim() || "Unknown track",
    trackMbId: track.trackMbId,
    recordingMbId: track.recordingMbId || track.trackMbId,
    duration: track.duration,
    artistNames: artists.map((artist) => artist.artistName),
    artistMbIds: artists.map((artist) => artist.artistMbId).filter((mbid): mbid is string => Boolean(mbid)),
    artists,
    releaseName: track.releaseName,
    releaseMbId: track.releaseMbId,
    isrc: track.isrc,
    originUri: track.originUri,
  };
}

/** Appends a track to a playlist the signed-in account can write to. */
export async function addPlaylistItem(
  agent: Agent,
  playlist: Pick<SocialPlaylistView, "uri" | "cid">,
  track: TrackViewLike,
  order: number,
): Promise<SocialPlaylistItemView> {
  const repo = agent.assertDid;

  const record = {
    $type: "fm.teal.feed.social.playlistItem",
    subject: { uri: playlist.uri, cid: playlist.cid },
    track: toTrackRecord(track),
    order,
    createdAt: new Date().toISOString(),
  };

  const res = await agent.com.atproto.repo.createRecord({ repo, collection: "fm.teal.feed.social.playlistItem", record });
  const { uri, cid } = res.data;

  return { uri, cid, authorDid: repo, track: record.track, order, createdAt: record.createdAt };
}

export type PlaylistEdits = {
  name: string;
  description: string;
  collaboratorsText: string;
  /** A newly picked local image to upload as the cover. */
  newCoverUri?: string;
};

/**
 * Rewrites a playlist record the signed-in account owns. Collaborator handles are
 * resolved first so a typo fails before anything is written; the cover blob is kept
 * unless a new image was picked.
 */
export async function savePlaylistRecord(
  agent: Agent,
  playlist: Pick<SocialPlaylistView, "uri" | "authorDid" | "createdAt">,
  edits: PlaylistEdits,
  resolveAuthors: (input: string, ownerDid: string) => Promise<string[]>,
) {
  // Alpha-era playlists stay in their own collection, with its record type.
  const [, , , collection = "fm.teal.feed.social.playlist", rkey = ""] = playlist.uri.split("/");
  const authors = await resolveAuthors(edits.collaboratorsText, playlist.authorDid);

  // SAFETY: getRecord returns this playlist's own record; only its cover is read.
  const current = await agent
    .call("com.atproto.repo.getRecord", { repo: playlist.authorDid, collection, rkey })
    .then((res) => res.data.value as { cover?: unknown });

  let cover = current.cover;

  if (edits.newCoverUri) {
    const data = await (await fetch(edits.newCoverUri)).blob();
    cover = (await agent.uploadBlob(data, { encoding: data.type || "image/jpeg" })).data.blob;
  }

  const text = edits.description.trim();
  let descriptionFacets: unknown[] | undefined;

  if (text) {
    const rich = new RichText({ text });
    await rich.detectFacets(agent);
    descriptionFacets = rich.facets;
  }

  await agent.call(
    "com.atproto.repo.putRecord",
    {},
    {
      repo: playlist.authorDid,
      collection,
      rkey,
      record: {
        $type: collection,
        name: edits.name.trim(),
        description: text || undefined,
        descriptionFacets,
        authors,
        cover,
        createdAt: playlist.createdAt,
      },
    },
  );
}
