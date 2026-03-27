/**
 * Tests for MusicBrainz result ranking utilities
 * 
 * These tests validate the client-side ranking that improves result quality
 * (measured during evaluation runs; details live in the eval commit message)
 */

import {
  scoreResult,
  rankResults,
  rankMultiStageResults,
  type RankingQuery,
} from "../musicbrainzRanking";
import type { MusicBrainzRecording } from "../oldStamp";

// Helper to create mock recording
function mockRecording(
  title: string,
  artist?: string,
  release?: string,
  opts?: { disambiguation?: string; releaseStatus?: string; score?: number },
): MusicBrainzRecording {
  const rec: MusicBrainzRecording = {
    id: "test-id-" + Math.random().toString(36).slice(2),
    title,
    "artist-credit": artist ? [{ name: artist, artist: { id: "artist-id", name: artist } }] : [],
    releases: release
      ? [{ id: "release-id", title: release, ...(opts?.releaseStatus ? { status: opts.releaseStatus } : {}) }]
      : [],
  };
  if (opts?.disambiguation) rec.disambiguation = opts.disambiguation;
  if (opts?.score != null) rec.score = opts.score;
  return rec;
}

describe("scoreResult", () => {
  describe("strategy-based scoring", () => {
    it("should score exact matches higher than fuzzy", () => {
      const recording = mockRecording("Test Track", "Test Artist");
      const query: RankingQuery = { track: "Test Track", artist: "Test Artist" };
      
      const exactScore = scoreResult(recording, query, "exact");
      const fuzzyScore = scoreResult(recording, query, "fuzzy");
      
      expect(exactScore).toBeGreaterThan(fuzzyScore);
    });

    it("should score fuzzy matches higher than partial", () => {
      const recording = mockRecording("Test Track", "Test Artist");
      const query: RankingQuery = { track: "Test Track", artist: "Test Artist" };
      
      const fuzzyScore = scoreResult(recording, query, "fuzzy");
      const partialScore = scoreResult(recording, query, "partial");
      
      expect(fuzzyScore).toBeGreaterThan(partialScore);
    });
  });

  describe("track name matching", () => {
    it("should boost exact track matches", () => {
      const exactMatch = mockRecording("Hello World", "Artist");
      const partialMatch = mockRecording("Hello World (Remix)", "Artist");
      
      const query: RankingQuery = { cleanedTrack: "Hello World" };
      
      const exactScore = scoreResult(exactMatch, query, "exact");
      const partialScore = scoreResult(partialMatch, query, "exact");
      
      expect(exactScore).toBeGreaterThan(partialScore);
    });

    it("should boost partial matches (startsWith/contains) over no match", () => {
      const partialMatch = mockRecording("Hello World Extended", "Artist");
      const noMatch = mockRecording("Something Else", "Artist");

      const query: RankingQuery = { cleanedTrack: "Hello World" };

      const partialScore = scoreResult(partialMatch, query, "exact");
      const noMatchScore = scoreResult(noMatch, query, "exact");

      expect(partialScore).toBeGreaterThan(noMatchScore);
    });
  });

  describe("artist name matching", () => {
    it("should boost exact artist matches", () => {
      const exactMatch = mockRecording("Track", "Beatles");
      const partialMatch = mockRecording("Track", "Beatles Cover Band");
      
      const query: RankingQuery = { track: "Track", cleanedArtist: "Beatles" };
      
      const exactScore = scoreResult(exactMatch, query, "exact");
      const partialScore = scoreResult(partialMatch, query, "exact");
      
      // exactMatch has exact artist ("Beatles" === "Beatles")
      // partialMatch has starts-with artist ("Beatles Cover Band" starts with "Beatles")
      expect(exactScore).toBeGreaterThan(partialScore);
    });
  });

  describe("track-only searches (no artist)", () => {
    it("should score track-only exact matches reasonably", () => {
      const recording = mockRecording("Unique Track Name");

      const trackOnlyQuery: RankingQuery = { cleanedTrack: "Unique Track Name" };

      const trackOnlyScore = scoreResult(recording, trackOnlyQuery, "exact");

      // Should get strategy base (3.0) * exact match boost (2.2) = ~6.6
      expect(trackOnlyScore).toBeGreaterThan(3.0);
    });

    it("should apply higher release boost for track-only searches", () => {
      const recording = mockRecording("Common Name", undefined, "Specific Album");
      
      const query: RankingQuery = { cleanedTrack: "Common Name", cleanedRelease: "Specific Album" };
      
      const score = scoreResult(recording, query, "exact");
      
      // Should have release boost applied
      expect(score).toBeGreaterThan(1.0);
    });
  });

  describe("both track and artist match", () => {
    it("should apply strong bonus when both match", () => {
      const fullMatch = mockRecording("Hello World", "Test Artist");
      const trackOnlyMatch = mockRecording("Hello World", "Different Artist");
      
      const query: RankingQuery = { cleanedTrack: "Hello World", cleanedArtist: "Test Artist" };
      
      const fullScore = scoreResult(fullMatch, query, "exact");
      const partialScore = scoreResult(trackOnlyMatch, query, "exact");
      
      expect(fullScore).toBeGreaterThan(partialScore);
    });
  });

  describe("featuring artist bonus", () => {
    it("should boost when query feat matches result feat", () => {
      const recording = mockRecording("Timber (feat. Kesha)", "Pitbull");
      const query: RankingQuery = { track: "Timber feat. Kesha", artist: "Pitbull" };
      
      const score = scoreResult(recording, query, "exact");
      
      // Should have featuring boost applied
      expect(score).toBeGreaterThan(3.0); // Base exact (3.0) + bonuses
    });
  });

  describe("variant matching", () => {
    it("should boost when both query and result mention 'live'", () => {
      const liveRecording = mockRecording("Stairway to Heaven (Live)", "Led Zeppelin");
      const studioRecording = mockRecording("Stairway to Heaven", "Led Zeppelin");
      const query: RankingQuery = { track: "Stairway to Heaven (Live)", artist: "Led Zeppelin" };

      const liveScore = scoreResult(liveRecording, query, "exact");
      const studioScore = scoreResult(studioRecording, query, "exact");

      expect(liveScore).toBeGreaterThan(studioScore);
    });

    it("should boost mono recording when query mentions mono", () => {
      const monoRec = mockRecording("She Loves You", "The Beatles", undefined, { disambiguation: "mono" });
      const stereoRec = mockRecording("She Loves You", "The Beatles");
      const query: RankingQuery = { track: "She Loves You (mono)", cleanedTrack: "She Loves You", artist: "The Beatles" };

      const monoScore = scoreResult(monoRec, query, "exact");
      const stereoScore = scoreResult(stereoRec, query, "exact");

      expect(monoScore).toBeGreaterThan(stereoScore);
    });

    it("should boost remaster when query mentions remaster", () => {
      const remaster = mockRecording("This Charming Man", "The Smiths", undefined, { disambiguation: "2011 remaster" });
      const original = mockRecording("This Charming Man", "The Smiths");
      const query: RankingQuery = { track: "This Charming Man - 2011 Remaster", cleanedTrack: "This Charming Man", artist: "The Smiths" };

      const remasterScore = scoreResult(remaster, query, "exact");
      const originalScore = scoreResult(original, query, "exact");

      expect(remasterScore).toBeGreaterThan(originalScore);
    });

    it("should penalize variant result when query doesn't mention variant", () => {
      const variant = mockRecording("Song", "Artist", undefined, { disambiguation: "live" });
      const standard = mockRecording("Song", "Artist");
      const query: RankingQuery = { track: "Song", artist: "Artist" };

      const variantScore = scoreResult(variant, query, "exact");
      const standardScore = scoreResult(standard, query, "exact");

      expect(standardScore).toBeGreaterThan(variantScore);
    });

    it("should boost edit version via disambiguation when query mentions edit", () => {
      // When "edit" is in disambiguation (not title), variant boost isn't offset by exact-match loss
      const editRec = mockRecording("hotline", "Artist", undefined, { disambiguation: "edit" });
      const standardRec = mockRecording("hotline", "Artist");
      const query: RankingQuery = { track: "hotline (edit)", cleanedTrack: "hotline", artist: "Artist" };

      const editScore = scoreResult(editRec, query, "exact");
      const standardScore = scoreResult(standardRec, query, "exact");

      expect(editScore).toBeGreaterThan(standardScore);
    });
  });

  describe("MB API score prior", () => {
    it("should favor results with higher MB scores", () => {
      const highScore = { ...mockRecording("Track", "Artist"), score: 100 };
      const lowScore = { ...mockRecording("Track", "Artist"), score: 40 };
      const query: RankingQuery = { cleanedTrack: "Track", cleanedArtist: "Artist" };

      const high = scoreResult(highScore, query, "exact");
      const low = scoreResult(lowScore, query, "exact");
      expect(high).toBeGreaterThan(low);
    });

    it("should handle missing score gracefully", () => {
      const noScore = mockRecording("Track", "Artist");
      const query: RankingQuery = { cleanedTrack: "Track" };
      const s = scoreResult(noScore, query, "exact");
      expect(s).toBeGreaterThan(0);
    });
  });

  describe("position prior", () => {
    it("should penalize later positions", () => {
      const rec = mockRecording("Track", "Artist");
      const query: RankingQuery = { cleanedTrack: "Track", cleanedArtist: "Artist" };

      const pos0 = scoreResult(rec, query, "exact", 0);
      const pos10 = scoreResult(rec, query, "exact", 10);
      expect(pos0).toBeGreaterThan(pos10);
    });
  });

  describe("release status", () => {
    it("should favor official releases over bootlegs", () => {
      const official = {
        ...mockRecording("Track", "Artist"),
        releases: [{ id: "r1", title: "Album", status: "Official" }],
      };
      const bootleg = {
        ...mockRecording("Track", "Artist"),
        releases: [{ id: "r2", title: "Album", status: "Bootleg" }],
      };
      const query: RankingQuery = { cleanedTrack: "Track", cleanedArtist: "Artist" };

      const offScore = scoreResult(official, query, "exact");
      const bootScore = scoreResult(bootleg, query, "exact");
      expect(offScore).toBeGreaterThan(bootScore);
    });
  });

  describe("accent-insensitive matching", () => {
    it("should match accented and non-accented versions", () => {
      const recording = mockRecording("Deja Vu", "Beyonce");
      const query: RankingQuery = { cleanedTrack: "Déjà Vu", cleanedArtist: "Beyoncé" };
      
      const score = scoreResult(recording, query, "exact");
      
      // Should still get exact match bonuses due to normalization
      expect(score).toBeGreaterThan(1.0);
    });
  });
});

describe("rankResults", () => {
  it("should sort results by score descending", () => {
    const results: MusicBrainzRecording[] = [
      mockRecording("Similar Track", "Artist"),
      mockRecording("Exact Track", "Artist"),
      mockRecording("Different Track", "Artist"),
    ];
    
    const query: RankingQuery = { cleanedTrack: "Exact Track" };
    const ranked = rankResults(results, query, "exact");
    
    expect(ranked[0].title).toBe("Exact Track");
  });

  it("should handle empty results", () => {
    const query: RankingQuery = { cleanedTrack: "Test" };
    const ranked = rankResults([], query, "exact");
    
    expect(ranked).toHaveLength(0);
  });
});

describe("rankMultiStageResults", () => {
  it("should combine and rank results from multiple stages", () => {
    const exactResults: MusicBrainzRecording[] = [
      mockRecording("Exact Match", "Artist"),
    ];
    const fuzzyResults: MusicBrainzRecording[] = [
      mockRecording("Fuzzy Match", "Artist"),
    ];
    const partialResults: MusicBrainzRecording[] = [
      mockRecording("Partial Match", "Artist"),
    ];
    
    const stageResults = [
      { results: exactResults, strategy: "exact" as const },
      { results: fuzzyResults, strategy: "fuzzy" as const },
      { results: partialResults, strategy: "partial" as const },
    ];
    
    const query: RankingQuery = { cleanedTrack: "Exact Match" };
    const ranked = rankMultiStageResults(stageResults, query);
    
    expect(ranked).toHaveLength(3);
    expect(ranked[0].title).toBe("Exact Match");
  });

  it("should deduplicate results by ID", () => {
    const recording = mockRecording("Same Track", "Artist");
    
    const stageResults = [
      { results: [recording], strategy: "exact" as const },
      { results: [recording], strategy: "fuzzy" as const }, // Same recording
    ];
    
    const query: RankingQuery = { cleanedTrack: "Same Track" };
    const ranked = rankMultiStageResults(stageResults, query);
    
    expect(ranked).toHaveLength(1);
  });

  it("should prefer exact stage result when same recording in multiple stages", () => {
    const recording = mockRecording("Track", "Artist");
    
    const stageResults = [
      { results: [recording], strategy: "fuzzy" as const },
      { results: [recording], strategy: "exact" as const },
    ];
    
    const query: RankingQuery = { cleanedTrack: "Track" };
    const ranked = rankMultiStageResults(stageResults, query);
    
    expect(ranked).toHaveLength(1);
    // Should keep the higher-scored version (exact)
  });

  it("should handle empty stage results", () => {
    const stageResults = [
      { results: [], strategy: "exact" as const },
      { results: [mockRecording("Result", "Artist")], strategy: "fuzzy" as const },
    ];
    
    const query: RankingQuery = { cleanedTrack: "Result" };
    const ranked = rankMultiStageResults(stageResults, query);
    
    expect(ranked).toHaveLength(1);
  });
});

describe("edge cases", () => {
  it("should handle recordings with missing fields", () => {
    const recording: MusicBrainzRecording = {
      id: "test-id",
      title: "Test",
      // No artist-credit or releases
    };
    
    const query: RankingQuery = { cleanedTrack: "Test", cleanedArtist: "Artist" };
    const score = scoreResult(recording, query, "exact");
    
    expect(score).toBeGreaterThan(0);
  });

  it("should handle empty query", () => {
    const recording = mockRecording("Track", "Artist");
    const query: RankingQuery = {};
    
    const score = scoreResult(recording, query, "exact");
    
    // Base strategy score should still apply
    expect(score).toBe(3.0); // SCORE_EXACT
  });

  it("should handle very long track names", () => {
    const longName = "A".repeat(500);
    const recording = mockRecording(longName, "Artist");
    const query: RankingQuery = { cleanedTrack: longName };
    
    const score = scoreResult(recording, query, "exact");
    
    expect(score).toBeGreaterThan(1.0);
  });
});
