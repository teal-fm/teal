import { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";

// MusicBrainz API Types
export interface MusicBrainzArtistCredit {
  artist: {
    id: string;
    name: string;
    "sort-name"?: string;
  };
  joinphrase?: string;
  name: string;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  "track-count"?: number;
}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  isrcs?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
  selectedRelease?: MusicBrainzRelease; // Added for UI state
}

export interface SearchParams {
  track?: string;
  artist?: string;
  release?: string;
}

export interface SearchResultProps {
  result: MusicBrainzRecording;
  onSelectTrack: (track: MusicBrainzRecording | null) => void;
  isSelected: boolean;
  selectedRelease: MusicBrainzRelease | null;
  onReleaseSelect: (trackId: string, release: MusicBrainzRelease) => void;
}

export interface ReleaseSelections {
  [key: string]: MusicBrainzRelease;
}

export interface PlaySubmittedData {
  playRecord: PlayRecord | null;
  playAtUrl: string | null;
  blueskyPostUrl: string | null;
}

export async function searchMusicbrainz(
  searchParams: SearchParams,
): Promise<MusicBrainzRecording[]> {
  try {
    const queryParts: string[] = [];
    if (searchParams.track) {
      queryParts.push(`title:"${searchParams.track}"`);
    }

    if (searchParams.artist) {
      queryParts.push(`artist:"${searchParams.artist}"`);
    }

    if (searchParams.release) {
      queryParts.push(`release:"${searchParams.release}"`);
    }


    const query = queryParts.join(" AND ");

    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(
        query,
      )}&fmt=json`,
      {
        headers: {
          "User-Agent": "tealtracker/0.0.1",
        },
      },
    );

    if (!res.ok) {
      throw new Error(`MusicBrainz API returned ${res.status}`);
    }

    const data = await res.json();
    return data.recordings || [];
  } catch (error) {
    console.error("Failed to fetch MusicBrainz data:", error);
    return [];
  }
}
