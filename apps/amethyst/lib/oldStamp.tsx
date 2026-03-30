import { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";

// Re-export searchMusicbrainz from the orchestrator module.
// This keeps backward compatibility for existing imports.
export { searchMusicbrainz } from "./searchOrchestrator";

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

export interface MusicBrainzReleaseGroup {
  id: string;
  title?: string;
  "primary-type"?: string;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  "track-count"?: number;
  "release-group"?: MusicBrainzReleaseGroup;
}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  score?: number; // MB API relevance score (0-100)
  length?: number;
  isrcs?: string[];
  disambiguation?: string;
  "first-release-date"?: string;
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
  selectedRelease?: MusicBrainzRelease;
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

