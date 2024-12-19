import { View } from "react-native";

import { useStore } from "@/stores/mainStore";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import {
  Record as Play,
  validateRecord,
} from "@/lexicons/server/types/fm/teal/alpha/play";

async function searchMusicbrainz(query: string) {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json`
    );
    const data = await res.json();
    return data.recordings?.[0]; // Get the first recording result
  } catch (error) {
    console.error("Failed to fetch MusicBrainz data:", error);
    return null;
  }
}

export default function TabTwoScreen() {
  const agent = useStore((state) => state.pdsAgent);

  const submitPlay = async () => {
    const query = "release title:this is why AND artist:Paramore";
    const result = await searchMusicbrainz(query);

    if (result) {
      console.log(result);
      const play: Play = {
        trackName: result.title ?? "Unknown Title",
        recordingMbId: result.id ?? undefined,
        duration: result.length ? Math.floor(result.length / 1000) : undefined, // Convert ms to seconds
        artistName:
          result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist",
        artistMbIds: result["artist-credit"]?.[0]?.artist?.id
          ? [result["artist-credit"][0].artist.id]
          : undefined,
        releaseName: result["releases"]?.[0]?.title ?? undefined,
        releaseMbId: result["releases"]?.[0]?.id ?? undefined,
        isrc: result.isrcs?.[0] ?? undefined,
        originUrl: `https://tidal.com/browse/track/274816578?u`,
        musicServiceBaseDomain: "tidal.com",
        submissionClientAgent: "tealtracker/0.0.1b",
        playedTime: new Date().toISOString(),
      };

      try {
        let result = validateRecord(play);
        console.log("Validated play:", result);
        console.log("Submitting play:", play);
        // const res = await agent?.call(
        //   "com.atproto.repo.createRecord",
        //   {},
        //   {
        //     repo: agent.did,
        //     collection: "fm.teal.alpha.play",
        //     rkey: undefined,
        //     record: play,
        //   }
        // );
        // console.log("Play submitted successfully:", res);
      } catch (error) {
        console.error("Failed to submit play:", error);
      }
    } else {
      console.error("No results found for the query.");
    }
  };

  return (
    <View className="flex-1 flex gap-2 items-center justify-center align-center w-full h-full bg-background">
      {agent ? (
        <Button onPress={() => submitPlay()}>
          <Text>Get Profile</Text>
        </Button>
      ) : (
        <Text>Loading...</Text>
      )}
    </View>
  );
}
