import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { MusicBrainzRecording } from "@/lib/oldStamp";

export const stampSearchSchema = z.object({
  track: z.string(),
  artist: z.string(),
  release: z.string(),
});
type StampSearch = z.infer<typeof stampSearchSchema> & {
  [v: string]: string;
};

const musicBrainzQueryUrl = 'https://musicbrainz.org/ws/2/recording';

export const searchMusicBrainz = async (query: StampSearch): Promise<MusicBrainzRecording[]> => {
  const url = new URL(musicBrainzQueryUrl);
  url.searchParams.set('fmt', 'json');

  const queryParts: string[] = [];
  Object.keys(query).map(v => {
    queryParts.push(`${v}:"${query[v]}"`);
  });
  url.searchParams.set('query', queryParts.join(' AND '));

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'tealtracker/0.0.1',
    },
  });

  if (!res.ok) 
    throw new Error(`MusicBrainz API returned ${res.status}`);

  const data = await res.json();
  return data.recordings || [];
};

export const useStampSearchMutation = () => {
  return useMutation({
    mutationKey: ['stamp:search'],
    mutationFn: (data: StampSearch) => searchMusicBrainz(data),
  });
};
