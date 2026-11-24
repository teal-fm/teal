import { useEffect, useRef, useState } from "react";
import type { MusicBrainzRecording, SearchParams } from "../oldStamp";
import { searchMusicbrainz } from "../searchOrchestrator";

type SearchState = {
  results: MusicBrainzRecording[] | null;
  searching: boolean;
  searchFailed: boolean;
};

const empty: SearchState = { results: null, searching: false, searchFailed: false };

export function useSongSearch() {
  const active = useRef<AbortController | null>(null);
  const [state, setState] = useState(empty);
  useEffect(() => () => active.current?.abort(), []);

  function resetSearch() {
    active.current?.abort();
    setState(empty);
  }

  async function searchSong(fields: SearchParams) {
    active.current?.abort();
    const request = new AbortController();
    active.current = request;
    setState({ ...empty, searching: true });

    try {
      const results = await searchMusicbrainz(fields, { throwOnError: true, signal: request.signal });

      if (!request.signal.aborted) setState({ ...empty, results });
    } catch {
      if (!request.signal.aborted) setState({ ...empty, searchFailed: true });
    }
  }

  return { ...state, searchSong, resetSearch };
}
