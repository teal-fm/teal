import { useStore } from "@/stores/mainStore";
import { Record as Play } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import { useEffect, useState } from "react";
import { Text, ScrollView } from "react-native";
import PlayView from "./playView";
interface ActorPlaysViewProps {
  repo: string | undefined;
}
interface PlayWrapper {
  cid: string;
  uri: string;
  value: Play;
}
const ActorPlaysView = ({ repo }: ActorPlaysViewProps) => {
  const [play, setPlay] = useState<PlayWrapper[] | null>(null);
  const agent = useStore((state) => state.pdsAgent);
  const isReady = useStore((state) => state.isAgentReady);
  useEffect(() => {
    if (agent) {
      agent
        .call("com.atproto.repo.listRecords", {
          repo,
          collection: "fm.teal.alpha.feed.play",
        })
        .then((profile) => {
          profile.data.records as PlayWrapper[];
          return setPlay(profile.data.records);
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      console.log("No agent");
    }
  }, [isReady, agent, repo]);
  if (!play) {
    return <Text>Loading...</Text>;
  }
  return (
    <ScrollView className="w-full *:gap-4">
      {play.map((p) => (
        <PlayView key={p.uri} play={p.value} />
      ))}
    </ScrollView>
  );
};

export default ActorPlaysView;
