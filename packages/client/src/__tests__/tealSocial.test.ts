import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import {
  playViewToTrackView,
  socialPostDeleteParams,
  trackViewToPlayView,
} from "../teal/social";

describe("Teal social track normalization", () => {
  it("normalizes new trackView artists into play artists", () => {
    const play = trackViewToPlayView({
      trackName: "Ceremony",
      recordingMbId: "recording-1",
      artists: [{ name: "New Order", mbid: "mbid:artist-1" }],
      releaseName: "Movement",
    });

    expect(play.trackName).toBe("Ceremony");
    expect(play.recordingMbId).toBe("recording-1");
    expect(play.artists).toEqual([
      { artistName: "New Order", artistMbId: "mbid:artist-1" },
    ]);
    expect(play.releaseName).toBe("Movement");
  });

  it("preserves deprecated artist arrays when publishing trackView", () => {
    const play: PlayView = {
      trackName: "Age of Consent",
      artists: [
        { artistName: "New Order", artistMbId: "mbid:artist-1" },
        { artistName: "Peter Hook" },
      ],
    };

    const track = playViewToTrackView(play);

    expect(track.artistNames).toEqual(["New Order", "Peter Hook"]);
    expect(track.artistMbIds).toEqual(["mbid:artist-1"]);
    expect(track.artists).toEqual([
      { artistName: "New Order", artistMbId: "mbid:artist-1" },
      { artistName: "Peter Hook", artistMbId: undefined },
    ]);
  });

  it("falls back to deprecated artist arrays for older social records", () => {
    const play = trackViewToPlayView({
      trackName: "Bizarre Love Triangle",
      artistNames: ["New Order"],
      artistMbIds: ["mbid:artist-1"],
    });

    expect(play.artists).toEqual([
      { artistName: "New Order", artistMbId: "mbid:artist-1" },
    ]);
  });
});

describe("post deletion ownership", () => {
  const did = "did:plc:listener";
  it("targets the author's exact post and uses its CID as a concurrent-edit guard", () => {
    expect(
      socialPostDeleteParams(
        `at://${did}/fm.teal.feed.social.post/test-post`,
        did,
        "original-cid",
      ),
    ).toEqual({
      repo: did,
      collection: "fm.teal.feed.social.post",
      rkey: "test-post",
      swapRecord: "original-cid",
    });
  });
  it.each([
    "at://did:plc:other/fm.teal.feed.social.post/test-post",
    `at://${did}/fm.teal.feed.play/test-post`,
    `at://${did}/fm.teal.feed.social.post/..`,
    `at://${did}/fm.teal.feed.social.post/test-post/extra`,
    `at://${did}/fm.teal.feed.social.post/test-post?other=record`,
  ])("rejects an unauthorized or malformed deletion URI: %s", (uri) => {
    expect(() => socialPostDeleteParams(uri, did, "cid")).toThrow(
      "Only your own",
    );
  });
  it("requires a current CID rather than deleting an unknown record version", () => {
    expect(() =>
      socialPostDeleteParams(
        `at://${did}/fm.teal.feed.social.post/test`,
        did,
        "",
      ),
    ).toThrow();
  });
});
