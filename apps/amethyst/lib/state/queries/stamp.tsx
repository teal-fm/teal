import { z } from "zod";
import { useMutation, UseMutationOptions, useQuery } from "@tanstack/react-query";
import { MusicBrainzRecording, searchMusicbrainz } from "@/lib/oldStamp";

export const stampSearchSchema = z.object({
  track: z.string(),
  artist: z.string(),
  release: z.string(),
});
type StampSearch = z.infer<typeof stampSearchSchema>;

export const StampSearchQueryKey = (data: StampSearch) => [
  'STAMP_MB_SEARCH',
  data.track,
  data.artist,
  data.release,
];

type useStampSearchQueryOpts = {
  data: StampSearch | (() => StampSearch);
} & UseMutationOptions<MusicBrainzRecording[]>;

export const useStampSearchMutation = ({ data }: useStampSearchQueryOpts) => {
  const getData = () => typeof data == 'function' ? data() : data;

  return useMutation({
    mutationKey: StampSearchQueryKey(getData()),
    mutationFn: () => searchMusicbrainz(getData()),
  });
};
