import { View } from "react-native";
import type { ListeningView } from "@/lib/teal/api";
import { Avatar, Cover, Glass, Text } from "@/next/components/ds";

/** A short note about someone's listening, woven between posts. */
export function Weave({ listen }: { listen: ListeningView }) {
  const a = listen.actor;
  const name = a?.displayName || a?.handle || "Someone";
  const what = listen.firstReleaseListen
    ? ["found ", listen.releaseName, " for the first time"]
    : [`has played ${listen.releasePlaysToday} songs from `, listen.releaseName, " today"];
  return (
    <Glass className="mx-1.5 mb-3.5 flex-row items-center gap-3 rounded-full py-2 pl-2 pr-2">
      <Avatar did={a?.did} avatar={a?.avatar} name={name} size={32} listeningNow={listen.listeningNow} />
      <Text className="flex-1 text-[15px] text-ink-2" numberOfLines={2}>
        <Text className="font-semibold text-ink">{name}</Text> {what[0]}
        <Text className="font-semibold text-ink">{what[1]}</Text>
        {what[2]}
      </Text>
      <Cover releaseMbId={listen.releaseMbId} size={44} radius={10} />
    </Glass>
  );
}

/** Notes worth weaving: someone deep in an album, or hearing one for the first time. */
export function weaveWorthy(listening: ListeningView[]) {
  return listening.filter((l) => l.releaseName && (l.releasePlaysToday >= 3 || l.firstReleaseListen)).slice(0, 3);
}
