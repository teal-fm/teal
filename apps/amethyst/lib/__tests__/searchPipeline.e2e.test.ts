/**
 * End-to-end tests for the MusicBrainz search pipeline.
 * Hits the real MusicBrainz API -- run manually, not on CI.
 *
 * Run: cd apps/amethyst && npx jest --config jest.lib.config.ts searchPipeline.e2e
 *
 * Tests the full chain: raw input -> cleaning -> multi-stage search -> ranking -> result
 */

import { searchMusicbrainz } from "../searchOrchestrator";
import {
  cleanTrackName,
  cleanArtistName,
  normalizeForComparison,
} from "../musicbrainzCleaner";

const RATE_LIMIT_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

jest.setTimeout(60000);

const RUN_E2E = process.env.RUN_E2E === "1" || process.env.RUN_E2E === "true";
const describeE2E = RUN_E2E ? describe : describe.skip;

// =============================================================================
// CLEANING UNIT TESTS (no API calls)
// =============================================================================

describe("cleaning pipeline", () => {
  it("preserves remaster+year (eval: stripping never helps, 11 regressions)", () => {
    expect(cleanTrackName("Bennie And The Jets (Remastered 2014)")).toBe(
      "Bennie And The Jets (Remastered 2014)"
    );
  });

  it("removes plain guff without year", () => {
    expect(cleanTrackName("Bennie And The Jets (Remastered)")).toBe(
      "Bennie And The Jets"
    );
  });

  it("preserves remix for short/generic base names", () => {
    expect(cleanTrackName("High (Branchez Remix)")).toBe(
      "High (Branchez Remix)"
    );
  });

  it("preserves remaster+year for long specific names", () => {
    expect(cleanTrackName("Bohemian Rhapsody (2011 Remastered Version)")).toBe(
      "Bohemian Rhapsody (2011 Remastered Version)"
    );
  });

  it('preserves "The" prefix in artist name', () => {
    expect(cleanArtistName("The Beatles")).toBe("The Beatles");
  });

  it("preserves non-Latin characters", () => {
    expect(normalizeForComparison("久石譲")).not.toBe("");
    expect(normalizeForComparison("봄날")).not.toBe("");
  });

  it("strips accents for comparison", () => {
    expect(normalizeForComparison("Beyoncé")).toBe("beyonce");
    expect(normalizeForComparison("Orquesta Filarmónica")).toBe(
      "orquesta filarmonica"
    );
  });
});

// =============================================================================
// E2E SEARCH TESTS (real MusicBrainz API)
// =============================================================================

describeE2E("e2e: search returns results (real MB API)", () => {
  it("finds Bohemian Rhapsody by Queen at P@1", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Bohemian Rhapsody",
      artist: "Queen",
    });

    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeForComparison(first.title)).toContain("bohemian rhapsody");

    const artists = (first["artist-credit"] || [])
      .map((a: any) => normalizeForComparison(a.artist?.name || ""))
      .join(" ");
    expect(artists).toContain("queen");
  });

  it("finds track with version suffix (dash-separated)", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Somebody's Watching Me - Single Version",
      artist: "Rockwell",
    });

    expect(results.length).toBeGreaterThan(0);
    // Check top 10 -- multi-stage search should find it even if not P@1
    const found = results
      .slice(0, 10)
      .some((r: any) =>
        normalizeForComparison(r.title).includes("somebody")
      );
    expect(found).toBe(true);
  });

  it("finds track with parenthetical remix", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Paper Planes (DFA Remix)",
      artist: "M.I.A.",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(normalizeForComparison(results[0].title)).toContain("paper planes");
  });

  it("finds track-only search (no artist) somewhere in results", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Bohemian Rhapsody",
    });

    expect(results.length).toBeGreaterThan(0);
    // Track-only search without artist is inherently ambiguous.
    // Just verify the pipeline returns results and doesn't crash.
    // The correct track should appear somewhere in the result set.
    const found = results.some((r: any) =>
      normalizeForComparison(r.title).includes("bohemian rhapsody")
    );
    expect(found).toBe(true);
  });

  it("finds Japanese artist", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Merry-Go-Round",
      artist: "久石譲",
    });

    expect(results.length).toBeGreaterThan(0);
    // Should find results -- may be credited as "Joe Hisaishi" in MB
    expect(results[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("finds track with accented artist name", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Dios Nunca Muere",
      artist: "Orquesta Filarmónica",
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it("handles featuring artist in title", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Unholy (feat. Kim Petras)",
      artist: "Sam Smith",
    });

    expect(results.length).toBeGreaterThan(0);
    // Check that "Unholy" appears somewhere in top 5 (not necessarily P@1)
    const top5Titles = results
      .slice(0, 5)
      .map((r: any) => normalizeForComparison(r.title));
    expect(top5Titles.some((t: string) => t.includes("unholy"))).toBe(true);
  });
});

// =============================================================================
// RESULT STRUCTURE (validates contract with submit.tsx)
// =============================================================================

describeE2E("e2e: result structure matches PlayRecord contract", () => {
  it("returns all fields needed by createPlayRecord()", async () => {
    await sleep(RATE_LIMIT_MS);
    const results = await searchMusicbrainz({
      track: "Bohemian Rhapsody",
      artist: "Queen",
    });

    expect(results.length).toBeGreaterThan(0);
    const r = results[0];

    // recordingMbId
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);

    // trackName
    expect(typeof r.title).toBe("string");
    expect(r.title.length).toBeGreaterThan(0);

    // artists[].artistMbId and artistName
    const credits = r["artist-credit"] as any[];
    expect(credits).toBeDefined();
    expect(credits!.length).toBeGreaterThan(0);
    expect(credits![0].artist.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof credits![0].artist.name).toBe("string");

    // releases[].id and title (for releaseMbId)
    expect(r.releases).toBeDefined();
    if (r.releases && r.releases.length > 0) {
      expect(r.releases[0].id).toMatch(/^[0-9a-f-]{36}$/);
      expect(typeof r.releases[0].title).toBe("string");
    }
  });
});
