import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import type { ArtistListenerView } from "@teal/lexicons/src/fm/teal/music/defs";
import { countLabel } from "@teal/client/teal/music";
import { Avatar, Text } from "@/components/ds";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";

function ListenerRow({ listener, rank, last }: { listener: ArtistListenerView; rank: number; last: boolean }) {
  const actor = useDisplayActor(listener.actor, listener.actor.did);
  return (
    <Link href={actor.href as never} asChild>
      <Pressable
        accessibilityLabel={`${rank}. ${actor.name}, ${countLabel(listener.playCount, "listen")}`}
        className={last ? "flex-row items-center gap-3 py-2.5" : "flex-row items-center gap-3 border-b border-hair py-2.5"}
      >
        <Text className="w-7 text-center text-[13px] font-semibold tabular-nums text-ink-2">{rank}</Text>
        <Avatar did={actor.did} avatar={actor.avatar} name={actor.name} size={40} />
        <Text className="min-w-0 flex-1 font-semibold" numberOfLines={1}>
          {actor.name}
        </Text>
        <Text className="text-[13px] tabular-nums text-ink-2">{countLabel(listener.playCount, "listen")}</Text>
      </Pressable>
    </Link>
  );
}

/** Who listens to an artist most, ranked. */
export function Leaderboard({ listeners, offset = 0 }: { listeners: readonly ArtistListenerView[]; offset?: number }) {
  return (
    <View>
      {listeners.map((listener, i) => (
        <ListenerRow key={listener.actor.did} listener={listener} rank={offset + i + 1} last={i === listeners.length - 1} />
      ))}
    </View>
  );
}
