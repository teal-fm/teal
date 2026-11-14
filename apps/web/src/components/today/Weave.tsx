import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import type { ListeningView } from "@teal/client/teal/api";
import { A, Avatar, Cover, Glass } from "~/ds";

/** A short note about someone's listening, woven between posts. */
export function Weave({ listen }: { listen: ListeningView }) {
  const a = useDisplayActor(listen.actor, listen.actor?.did);
  const what = listen.firstReleaseListen
    ? ["found ", listen.releaseName, " for the first time"]
    : [`has played ${listen.releasePlaysToday} songs from `, listen.releaseName, " today"];
  return (
    <Glass className="mx-1.5 mb-3.5 flex items-center gap-3 rounded-full py-2 pr-2 pl-2">
      <A href={a.href} aria-label={`${a.name}'s profile`}>
        <Avatar did={a.did} avatar={a.avatar} name={a.name} size={32} listeningNow={listen.listeningNow} />
      </A>
      <p className="line-clamp-2 flex-1 text-[15px] text-ink-2">
        <span className="font-semibold text-ink">{a.name}</span> {what[0]}
        <span className="font-semibold text-ink">{what[1]}</span>
        {what[2]}
      </p>
      <Cover releaseMbId={listen.releaseMbId} size={44} radius={10} />
    </Glass>
  );
}

/** Notes worth weaving: someone deep in an album, or hearing one for the first time. */
export function weaveWorthy(listening: ListeningView[]) {
  return listening.filter((l) => l.releaseName && (l.releasePlaysToday >= 3 || l.firstReleaseListen)).slice(0, 3);
}
