import { RichText, type Agent, type BlobRef } from "@atproto/api";

type CardyBResponse = {
  error: string;
  likely_type: string;
  url: string;
  title: string;
  description: string;
  image: string;
};
// call CardyB API to get embed card
const getUrlMetadata = async (url: string): Promise<CardyBResponse> => {
  const response = await fetch(`https://cardyb.bsky.app/v1/extract?url=${url}`);
  if (response.status === 200) {
    return await response.json();
  } else {
    throw new Error("Failed to fetch metadata from CardyB");
  }
};

interface EmbedCard {
  $type: string;
  external: {
    uri: string;
    title: string;
    description: string;
    thumb: BlobRef;
    alt: string;
    cardyThumbUrl: string;
  };
}

export const getBlueskyEmbedCard = async (
  url: string | undefined,
  agent: Agent,
  customUrl?: string,
  customTitle?: string,
  customDescription?: string,
): Promise<EmbedCard | undefined> => {
  if (!url) return;

  try {
    const metadata = await getUrlMetadata(url);
    const blob = await fetch(metadata.image).then((r) => r.blob());
    const { data } = await agent.uploadBlob(blob, { encoding: "image/jpeg" });

    return {
      $type: "app.bsky.embed.external",
      external: {
        uri: customUrl || metadata.url,
        title: customTitle || metadata.title,
        description: customDescription || metadata.description,
        thumb: data.blob,
        alt: metadata.title,
        cardyThumbUrl: metadata.image,
      },
    };
  } catch (error) {
    return;
  }
};
interface EmbedInfo {
  urlEmbed: string;
  customUrl: string;
}
export const getEmbedInfo = async (mbid: string): Promise<EmbedInfo | null> => {
  let appleMusicResponse = await fetch(
    `https://labs.api.listenbrainz.org/apple-music-id-from-mbid/json?recording_mbid=${mbid}`,
  );
  if (appleMusicResponse.status === 200) {
    const appleMusicData = await appleMusicResponse.json();
    if (appleMusicData[0].apple_music_track_ids.length > 0) {
      let trackId = appleMusicData[0].apple_music_track_ids[0];
      return {
        urlEmbed: `https://music.apple.com/us/song/its-not-living-if-its-not-with-you/${trackId}`,
        customUrl: `https://song.link/i/${trackId}`,
      };
    } else {
      let spotifyResponse = await fetch(
        `https://labs.api.listenbrainz.org/spotify-id-from-mbid/json?recording_mbid=${mbid}`,
      );
      if (spotifyResponse.status === 200) {
        const spotifyData = await spotifyResponse.json();
        if (spotifyData[0].spotify_track_ids.length > 0) {
          let trackId = spotifyData[0].spotify_track_ids[0];
          return {
            urlEmbed: `https://open.spotify.com/track/${trackId}`,
            customUrl: `https://song.link/s/${trackId}`,
          };
        }
      }
    }
  }
  return null;
};

export const ms2hms = (ms: number): string => {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  minutes = minutes % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};


/** The default Bluesky post text for a listen. */
export function crossPostText(recording: { title: string; "artist-credit"?: { artist: { name: string } }[] }) {
  const artists = recording["artist-credit"]?.map((credit) => credit.artist.name).join(", ");
  return `💮 now playing:\n${recording.title}${artists ? ` by ${artists}` : ""}\npowered by @teal.fm`;
}

/**
 * Posts a listen to Bluesky with a song.link card when Apple Music or Spotify knows
 * the recording. Returns the post's bsky.app URL.
 */
export async function crossPostListen(
  agent: Agent,
  text: string,
  recording: { id: string; title: string; length?: number; selectedRelease?: { date?: string } },
  artistNames: string,
) {
  const rich = new RichText({ text });
  await rich.detectFacets(agent);
  const links = await getEmbedInfo(recording.id).catch(() => null);
  const year = recording.selectedRelease?.date?.split("-")[0];
  const description = ["Song", year, recording.length ? ms2hms(recording.length) : undefined].filter(Boolean).join(" · ");
  const embed = links?.urlEmbed
    ? await getBlueskyEmbedCard(links.urlEmbed, agent, links.customUrl, `${recording.title} by ${artistNames}`, description)
    : undefined;
  const post = await agent.post({ text: rich.text, facets: rich.facets, embed: embed as never });
  return post.uri.replace("at://", "https://bsky.app/profile/").replace("app.bsky.feed.post", "post");
}
