import { RichText, type Agent } from "@atproto/api";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import type { MusicBrainzRecording, MusicBrainzRelease } from "../oldStamp";
import type { SocialPostView } from "./api";
import { playViewToTrackView } from "./social";

export type ReplyTarget = Pick<
  SocialPostView,
  "uri" | "cid" | "replyRootUri" | "replyParentUri" | "replyRootCid" | "replyParentCid"
>;

/** Hashtags in a post, as the lexicon's `tags` (eight at most). */
export function extractTags(text: string) {
  return Array.from(text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,64})/gu))
    .map((match) => match[2])
    .slice(0, 8);
}

function currentLangs() {
  if (typeof navigator === "undefined") return undefined;
  const language = navigator.language?.split("-")[0];
  return language ? [language] : undefined;
}

/** The release to attach when MusicBrainz offers several: the earliest worldwide or US one that isn't a single. */
function bestRelease(recording: MusicBrainzRecording) {
  const releases = [...(recording.releases || [])].sort(
    (a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  return (
    releases.find((r) => (r.country === "XW" || r.country === "US") && r.title !== recording.title) ||
    releases.find((r) => r.title !== recording.title) ||
    releases[0]
  );
}

export function musicBrainzToPlayView(recording: MusicBrainzRecording, release?: MusicBrainzRelease): PlayView {
  const chosen = release || recording.selectedRelease || bestRelease(recording);
  return {
    trackName: recording.title || "Unknown track",
    trackMbId: recording.id ? `mbid:${recording.id}` : undefined,
    recordingMbId: recording.id ? `mbid:${recording.id}` : undefined,
    duration: recording.length ? Math.floor(recording.length / 1000) : undefined,
    artists:
      recording["artist-credit"]?.map((credit) => ({
        artistName: credit.name || credit.artist.name,
        artistMbId: credit.artist.id ? `mbid:${credit.artist.id}` : undefined,
      })) || [],
    releaseName: chosen?.title,
    releaseMbId: chosen?.id ? `mbid:${chosen.id}` : undefined,
    isrc: recording.isrcs?.[0],
    originUri: recording.id ? `https://musicbrainz.org/recording/${recording.id}` : undefined,
  } as PlayView;
}

/**
 * Publishes a song post (or a reply, which carries its parent's track) and returns
 * the new post in view shape so the UI can show it before the index catches up.
 */
export async function publishPost(
  agent: Agent,
  input: { text: string; track: PlayView; replyTo?: ReplyTarget; author?: SocialPostView["author"] },
): Promise<SocialPostView> {
  const repo = agent.assertDid;
  const text = input.text.trim();
  const rich = new RichText({ text });
  await rich.detectFacets(agent);
  const tags = extractTags(text);
  const reply = input.replyTo
    ? {
        root: {
          uri: input.replyTo.replyRootUri || input.replyTo.uri,
          cid: input.replyTo.replyRootCid || input.replyTo.cid,
        },
        parent: { uri: input.replyTo.uri, cid: input.replyTo.cid },
      }
    : undefined;
  const record = {
    $type: "fm.teal.feed.social.post",
    text,
    track: playViewToTrackView(input.track),
    reply,
    facets: rich.facets,
    tags,
    langs: currentLangs(),
    createdAt: new Date().toISOString(),
  };
  const res = await agent.call("com.atproto.repo.createRecord", {}, { repo, collection: "fm.teal.feed.social.post", record });
  const { uri = "", cid = "" } = res.data as { uri?: string; cid?: string };
  return {
    uri,
    cid,
    authorDid: repo,
    author: input.author,
    text,
    track: record.track,
    replyRootUri: reply?.root.uri,
    replyRootCid: reply?.root.cid,
    replyParentUri: reply?.parent.uri,
    replyParentCid: reply?.parent.cid,
    facets: rich.facets,
    tags,
    langs: record.langs,
    createdAt: record.createdAt,
    likeCount: 0,
    repostCount: 0,
    replyCount: 0,
  } as SocialPostView;
}
