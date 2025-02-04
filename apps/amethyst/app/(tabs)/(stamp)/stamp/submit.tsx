import VerticalPlayView from "@/components/play/verticalPlayView";
import { Button } from "@/components/ui/button";
import { useStore } from "@/stores/mainStore";
import { Agent, ComAtprotoRepoCreateRecord, RichText } from "@atproto/api";
import {
  Record as PlayRecord,
  validateRecord,
} from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import { Stack, useRouter } from "expo-router";
import { useContext, useState } from "react";
import { Switch, View } from "react-native";
import { MusicBrainzRecording, PlaySubmittedData } from "@/lib/oldStamp";
import { Text } from "@/components/ui/text";
import { ExternalLink } from "@/components/ExternalLink";
import { StampContext, StampContextValue, StampStep } from "./_layout";

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

const getBlueskyEmbedCard = async (
  url: string | undefined,
  agent: Agent,
  customUrl?: string,
  customTitle?: string,
  customDescription?: string,
) => {
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
      },
    };
  } catch (error) {
    console.error("Error fetching embed card:", error);
    return;
  }
};
interface EmbedInfo {
  urlEmbed: string;
  customUrl: string;
}
const getEmbedInfo = async (mbid: string): Promise<EmbedInfo | null> => {
  let appleMusicResponse = await fetch(
    `https://labs.api.listenbrainz.org/apple-music-id-from-mbid/json?recording_mbid=${mbid}`,
  );
  if (appleMusicResponse.status === 200) {
    const appleMusicData = await appleMusicResponse.json();
    console.log("Apple Music data:", appleMusicData);
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
        console.log("Spotify data:", spotifyData);
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

const ms2hms = (ms: number): string => {
  let seconds = Math.floor(ms / 1000);
  let minutes = Math.floor(seconds / 60);
  seconds = seconds % 60;
  minutes = minutes % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const createPlayRecord = (result: MusicBrainzRecording): PlayRecord => {
  let artistNames: string[] = [];
  if (result["artist-credit"]) {
    artistNames = result["artist-credit"].map((a) => a.artist.name);
  } else {
    throw new Error("Artist must be specified!");
  }

  return {
    trackName: result.title ?? "Unknown Title",
    recordingMbId: result.id ?? undefined,
    duration: result.length ? Math.floor(result.length / 1000) : undefined,
    artistNames, // result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist",
    artistMbIds: result["artist-credit"]?.map((a) => a.artist.id) ?? undefined,
    releaseName: result.selectedRelease?.title ?? undefined,
    releaseMbId: result.selectedRelease?.id ?? undefined,
    isrc: result.isrcs?.[0] ?? undefined,
    // not providing unless we have a way to map to tidal/odesli/etc
    //originUrl: `https://tidal.com/browse/track/274816578?u`,
    musicServiceBaseDomain: "tidal.com",
    submissionClientAgent: "tealtracker/0.0.1b",
    playedTime: new Date().toISOString(),
  };
};

export default function Submit() {
  const router = useRouter();
  const agent = useStore((state) => state.pdsAgent);
  const ctx = useContext(StampContext);
  const { state, setState } = ctx as StampContextValue;

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shareWithBluesky, setShareWithBluesky] = useState<boolean>(false);

  if (state.step !== StampStep.SUBMITTING) {
    console.log("Stamp step is not SUBMITTING");
    console.log(state);
    return <Text>No track selected?</Text>;
    //return <Redirect href="/stamp" />;
  }

  const selectedTrack = state.submittingStamp;

  if (selectedTrack === null) {
    return <Text>No track selected</Text>;
  }

  // TODO: PLEASE refactor me ASAP!!!
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let record = createPlayRecord(selectedTrack);
      let result = validateRecord(record);
      if (result.success === false) {
        throw new Error("Failed to validate play: " + result.error);
      }
      console.log("Validated play:", result);
      const res = await agent?.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.alpha.feed.play",
          rkey: undefined,
          record,
        },
      );
      if (!res || res.success === false) {
        throw new Error("Failed to submit play!");
      }
      const typed: ComAtprotoRepoCreateRecord.Response = res;
      console.log("Play submitted successfully:", res);
      let submittedData: PlaySubmittedData = {
        playAtUrl: typed.data.uri,
        playRecord: record,
        blueskyPostUrl: null,
      };
      if (shareWithBluesky && agent) {
        // lol this type
        const rt = new RichText({
          text: `💮 now playing:
${record.trackName} by ${record.artistNames.join(", ")}

powered by @teal.fm`,
        });
        await rt.detectFacets(agent);
        // get metadata from Apple if available
        // https://labs.api.listenbrainz.org/apple-music-id-from-mbid/json?recording_mbid=81c3eb6e-d8f4-423c-9007-694aefe62754
        // https://music.apple.com/us/album/i-always-wanna-die-sometimes/1435546528?i=1435546783
        let embedInfo = await getEmbedInfo(selectedTrack.id);
        let urlEmbed: string | undefined = embedInfo?.urlEmbed;
        let customUrl: string | undefined = embedInfo?.customUrl;

        let releaseYear = selectedTrack.selectedRelease?.date?.split("-")[0];
        let title = `${record.trackName} by ${record.artistNames.join(", ")}`;
        let description = `Song${releaseYear && " · "}${releaseYear}${
          selectedTrack.length && " · " + ms2hms(selectedTrack.length)
        }`;

        const post = await agent.post({
          text: rt.text,
          facets: rt.facets,
          embed: urlEmbed
            ? await getBlueskyEmbedCard(
                urlEmbed,
                agent,
                customUrl,
                title,
                description,
              )
            : undefined,
        });
        submittedData.blueskyPostUrl = post.uri;
      }
      setState({
        step: StampStep.SUBMITTED,
        submittedStamp: submittedData,
      });
      // wait for state updates
      await Promise.resolve();
      router.replace({
        pathname: "/stamp/success",
      });
    } catch (error) {
      console.error("Failed to submit play:", error);
    }
    setIsSubmitting(false);
  };

  return (
    <View className="flex-1 p-4 bg-background items-center h-screen-safe">
      <Stack.Screen
        options={{
          title: "Submit Stamp",
        }}
      />
      <View className="flex justify-between align-middle gap-4 max-w-screen-md w-screen min-h-full px-4">
        <Text className="font-bold text-lg">Submit Play</Text>
        <View>
          <VerticalPlayView
            releaseMbid={selectedTrack?.selectedRelease?.id || ""}
            trackTitle={
              selectedTrack?.title ||
              "No track selected! This should never happen!"
            }
            artistName={selectedTrack?.["artist-credit"]
              ?.map((a) => a.artist?.name)
              .join(", ")}
            releaseTitle={selectedTrack?.selectedRelease?.title}
          />
          <Text className="text-sm text-gray-500 text-center mt-4">
            Any missing info?{" "}
            <ExternalLink
              className="text-blue-600 dark:text-blue-400"
              href={`https://musicbrainz.org/recording/${selectedTrack.id}`}
            >
              Contribute on MusicBrainz
            </ExternalLink>
          </Text>
        </View>

        <View className="flex-col gap-4 items-center">
          <View className="flex-row gap-2 items-center">
            <Switch
              value={shareWithBluesky}
              onValueChange={setShareWithBluesky}
            />
            <Text className="text-lg text-gray-500 text-center">
              Share with Bluesky?
            </Text>
          </View>
          <View className="flex-row gap-2 w-full">
            <Button
              className="flex-1"
              onPress={handleSubmit}
              disabled={isSubmitting || selectedTrack === null}
            >
              <Text>{isSubmitting ? "Submitting..." : "Submit"}</Text>
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}
