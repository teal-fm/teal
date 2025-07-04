import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";
import { Agent } from "@atproto/api";

import { OutputSchema as ActorFeedResponse } from "@teal/lexicons/src/types/fm/teal/alpha/feed/getActorFeed";

import PlayView from "./playView";

interface ActorPlaysViewProps {
  repo: string | undefined;
  pdsAgent: Agent | null;
}
const ActorPlaysView = ({ repo, pdsAgent }: ActorPlaysViewProps) => {
  const [play, setPlay] = useState<ActorFeedResponse["plays"] | null>(null);
  const isReady = useStore((state) => state.isAgentReady);
  const tealDid = useStore((state) => state.tealDid);
  useEffect(() => {
    if (pdsAgent) {
      pdsAgent
        .call(
          "fm.teal.alpha.feed.getActorFeed",
          { authorDID: repo },
          {},
          { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
        )
        .then((res) => {
          res.data.plays as ActorFeedResponse;
          return setPlay(res.data.plays);
        })
        .catch((e) => {
          console.log(e);
        });
    } else {
      console.log("No agent");
    }
  }, [isReady, pdsAgent, repo, tealDid]);
  if (!play) {
    return <Text>Loading...</Text>;
  }
  return (
    <ScrollView className="w-full *:gap-4">
      {play.map((p) => (
        <PlayView
          key={p.playedTime + p.trackName}
          dateListened={p.playedTime ? new Date(p.playedTime) : undefined}
          trackTitle={p.trackName}
          artistName={p.artists.map((a) => a.artistName).join(", ")}
          releaseMbid={p.releaseMbId}
        />
      ))}
    </ScrollView>
  );
};

export default ActorPlaysView;
