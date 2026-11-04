import { useQuery } from "@tanstack/react-query";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { getRecordingCoverArtUrl } from "@/lib/teal/api";

/** Art for a listen that has no release: the first release MusicBrainz lists for its recording. */
export function useRecordingArt(play?: Pick<PlayView, "releaseMbId" | "recordingMbId">) {
  const art = useQuery({
    queryKey: ["recording-art", play?.recordingMbId],
    queryFn: async () => (await getRecordingCoverArtUrl(play!.recordingMbId, 500)) ?? null,
    enabled: !!play && !play.releaseMbId && !!play.recordingMbId,
    staleTime: (query) => (query.state.data ? Infinity : 10 * 60_000),
  });
  return art.data ?? undefined;
}
