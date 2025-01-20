import VerticalPlayView from "@/components/play/verticalPlayView";
import { Button } from "@/components/ui/button";
import { useStore } from "@/stores/mainStore";
import { ComAtprotoRepoCreateRecord } from "@atproto/api";
import {
  Record as PlayRecord,
  validateRecord,
} from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";
import {
  MusicBrainzRecording,
  PlaySubmittedData,
} from "../../../../lib/oldStamp";

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
  // awful awful awful!
  // I don't wanna use global state for something like this though!
  const { track } = useLocalSearchParams();

  const selectedTrack: MusicBrainzRecording | null = JSON.parse(
    track as string
  );

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [shareWithBluesky, setShareWithBluesky] = useState<boolean>(false);

  if (selectedTrack === null) {
    return <Text>No track selected</Text>;
  }

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
        }
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
      router.push({
        pathname: "/stamp/success",
        params: { submittedData: JSON.stringify(submittedData) },
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
        <VerticalPlayView
          releaseMbid={selectedTrack?.selectedRelease?.id || ""}
          trackTitle={
            selectedTrack?.title ||
            "No track selected! This should never happen!"
          }
          artistName={selectedTrack?.["artist-credit"]?.[0]?.artist?.name}
          releaseTitle={selectedTrack?.selectedRelease?.title}
        />

        <View className="flex-col gap-2 items-center">
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
