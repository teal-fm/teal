import { useContext, useEffect, useState } from "react";
import { Image, Switch, View } from "react-native";
import { Redirect, Stack, useRouter } from "expo-router";
import { ExternalLink } from "@/components/ExternalLink";
import VerticalPlayView from "@/components/play/verticalPlayView";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { MusicBrainzRecording, PlaySubmittedData } from "@/lib/oldStamp";
import { cn } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import {
  Agent,
  BlobRef,
  ComAtprotoRepoCreateRecord,
  RichText,
} from "@atproto/api";

import { Artist } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import {
  Record as PlayRecord,
  validateRecord,
} from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";

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

const getBlueskyEmbedCard = async (
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
  let artists = result["artist-credit"]?.map(
    (a) =>
      ({
        artistName: a.artist.name,
        artistMbId: a.artist.id,
      }) as Artist,
  );

  console.log("artists", artists);

  return {
    trackName: result.title ?? "Unknown Title",
    recordingMbId: result.id ?? undefined,
    duration: result.length ? Math.floor(result.length / 1000) : undefined,
    artists: artists,
    releaseName: result.selectedRelease?.title ?? undefined,
    releaseMbId: result.selectedRelease?.id ?? undefined,
    isrc: result.isrcs?.[0] ?? undefined,
    // not providing unless we have a way to map to tidal/odesli/etc w/out MB
    //originUrl: `https://tidal.com/browse/track/274816578?u`,
    //musicServiceBaseDomain: "tidal.com",
    // TODO: update this based on version/git commit hash on build
    submissionClientAgent: "tealtracker/0.0.1b",
    playedTime: new Date().toISOString(),
  } as PlayRecord;
};

export default function Submit() {
  const router = useRouter();
  const agent = useStore((state) => state.pdsAgent);
  const ctx = useContext(StampContext);
  const { state, setState } = ctx as StampContextValue;

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shareWithBluesky, setShareWithBluesky] = useState<boolean>(false);
  const [blueskyPostText, setBlueskyPostText] = useState<string>("");

  const [blueskyEmbedCard, setBlueskyEmbedCard] = useState<EmbedCard | null>(
    null,
  ); // State to store Bluesky embed card

  const selectedTrack =
    state.step === StampStep.SUBMITTING ? state.submittingStamp : null;

  // Effect to initialize blueskyPostText when selectedTrack changes
  useEffect(() => {
    if (selectedTrack) {
      const defaultText = `💮 now playing:
${selectedTrack.title} by ${selectedTrack["artist-credit"]?.map((a) => a.artist.name).join(", ")}

powered by @teal.fm`;
      setBlueskyPostText(defaultText);
    }
  }, [selectedTrack]);

  useEffect(() => {
    const fetchEmbedData = async (id: string) => {
      try {
        let info = await getEmbedInfo(id);
        if (info) {
          // After getting embedInfo, fetch Bluesky embed card
          if (info.urlEmbed && agent && selectedTrack) {
            // Ensure urlEmbed exists and agent is available
            let releaseYear =
              selectedTrack?.selectedRelease?.date?.split("-")[0];
            let title = `${selectedTrack?.title} by ${selectedTrack?.["artist-credit"]?.map((artist) => artist.name).join(", ")}`;
            let description = `Song${releaseYear ? " · " + releaseYear : ""}${
              selectedTrack?.length && " · " + ms2hms(selectedTrack.length)
            }`;
            const card = await getBlueskyEmbedCard(
              info.urlEmbed,
              agent,
              info.customUrl,
              title,
              description,
            );
            console.log(card?.external.thumb);
            if (card) setBlueskyEmbedCard(card); // Store the fetched Bluesky embed card
          }
        }
      } catch (error) {
        console.error("Error fetching embed info:", error);
        return null;
      }
    };

    if (selectedTrack?.id && shareWithBluesky) {
      fetchEmbedData(selectedTrack.id);
    }
  }, [selectedTrack, agent, shareWithBluesky]);

  if (state.step !== StampStep.SUBMITTING) {
    console.log("Stamp step is not SUBMITTING");
    console.log(state);
    return <Redirect href="/stamp" />;
  }

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
          text: blueskyPostText,
        });
        await rt.detectFacets(agent);
        let embedInfo = await getEmbedInfo(selectedTrack.id);
        let urlEmbed: string | undefined = embedInfo?.urlEmbed;
        let customUrl: string | undefined = embedInfo?.customUrl;

        let releaseYear = selectedTrack.selectedRelease?.date?.split("-")[0];
        let title = `${record.trackName} by ${record.artists?.map((a) => a.artistName).join(", ")}`;
        let description = `Song${releaseYear ? " · " + releaseYear : ""}${
          selectedTrack.length && " · " + ms2hms(selectedTrack.length)
        }`;

        const post = await agent.post({
          text: rt.text,
          facets: rt.facets,
          embed: urlEmbed
            ? ((await getBlueskyEmbedCard(
                urlEmbed,
                agent,
                customUrl,
                title,
                description,
              )) as any)
            : undefined,
        });
        submittedData.blueskyPostUrl = post.uri
          .replace("at://", "https://bsky.app/profile/")
          .replace("app.bsky.feed.post", "post");
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
    <View className="h-screen-safe flex-1 items-center bg-background p-4">
      <Stack.Screen
        options={{
          title: "Submit Stamp",
        }}
      />
      <View className="flex min-h-full w-screen max-w-2xl justify-between gap-4 px-4 align-middle">
        <View />
        <View>
          <VerticalPlayView
            size={blueskyEmbedCard && shareWithBluesky ? "sm" : "md"}
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
          <Text className="mt-4 text-center text-sm text-gray-500">
            Any missing info?{" "}
            <ExternalLink
              className="text-blue-600 dark:text-blue-400"
              href={`https://musicbrainz.org/recording/${selectedTrack.id}`}
            >
              Contribute on MusicBrainz
            </ExternalLink>
          </Text>
        </View>

        <View className="w-full flex-col items-center gap-4">
          {blueskyEmbedCard && shareWithBluesky ? (
            <View className="w-full gap-2">
              <Text className="text-center text-sm text-muted-foreground">
                Card Preview:
              </Text>
              <View className="flex-col items-start rounded-xl border border-border bg-card">
                <Image
                  source={{
                    uri: blueskyEmbedCard.external.cardyThumbUrl,
                  }}
                  className="aspect-video w-full rounded-t-xl"
                />
                <View className="items-start p-2">
                  <Text className="text-start font-semibold text-card-foreground">
                    {blueskyEmbedCard.external.title}
                  </Text>
                  <Text className="text-start text-muted-foreground">
                    {blueskyEmbedCard.external.description}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            shareWithBluesky && (
              <Text className="text-center text-sm text-muted-foreground">
                jsyk: there won't be an embed card on your post.
              </Text>
            )
          )}
          {shareWithBluesky && (
            <View className="w-full items-end text-sm text-muted-foreground">
              <Textarea
                className="max-h-[200px] min-h-[100px] w-full rounded-md border border-border bg-card p-2 pb-4 text-card-foreground"
                multiline
                value={blueskyPostText}
                onChangeText={setBlueskyPostText}
                placeholder="Enter your Bluesky post text here..."
              />
              <Text
                className={cn(
                  "absolute bottom-1 right-2 text-center text-sm text-muted-foreground",
                  blueskyPostText.length > 150
                    ? "text-gray-600 dark:text-gray-300"
                    : "",
                  blueskyPostText.length > 290 ? "text-red-500" : "",
                )}
              >
                {blueskyPostText.length}/300
              </Text>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <Switch
              value={shareWithBluesky}
              onValueChange={setShareWithBluesky}
            />
            <Text className="text-center text-lg text-muted-foreground">
              Share with Bluesky?
            </Text>
          </View>
          <View className="w-full flex-row gap-2">
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
