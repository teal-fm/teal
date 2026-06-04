import { playViewToTrackView, trackViewToPlayView } from "../teal/social";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

describe("Teal social track normalization", () => {
  it("normalizes new trackView artists into play artists", () => {
    const play = trackViewToPlayView({
      trackName: "Ceremony",
      recordingMbId: "recording-1",
      artists: [{ name: "New Order", mbid: "artist-1" }],
      releaseName: "Movement",
    });

    expect(play.trackName).toBe("Ceremony");
    expect(play.recordingMbId).toBe("recording-1");
    expect(play.artists).toEqual([
      { artistName: "New Order", artistMbId: "artist-1" },
    ]);
    expect(play.releaseName).toBe("Movement");
  });

  it("preserves deprecated artist arrays when publishing trackView", () => {
    const play: PlayView = {
      trackName: "Age of Consent",
      artists: [
        { artistName: "New Order", artistMbId: "artist-1" },
        { artistName: "Peter Hook" },
      ],
    };

    const track = playViewToTrackView(play);

    expect(track.artistNames).toEqual(["New Order", "Peter Hook"]);
    expect(track.artistMbIds).toEqual(["artist-1"]);
    expect(track.artists).toEqual([
      { artistName: "New Order", artistMbId: "artist-1" },
      { artistName: "Peter Hook", artistMbId: undefined },
    ]);
  });

  it("falls back to deprecated artist arrays for older social records", () => {
    const play = trackViewToPlayView({
      trackName: "Bizarre Love Triangle",
      artistNames: ["New Order"],
      artistMbIds: ["artist-1"],
    });

    expect(play.artists).toEqual([
      { artistName: "New Order", artistMbId: "artist-1" },
    ]);
  });
});
