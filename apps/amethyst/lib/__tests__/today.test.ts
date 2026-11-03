import type { ListeningView, MomentView } from "../teal/api";
import { listeningFact, momentLine, ordinal, shortAgo } from "../teal/today";

const listen = (over: Partial<ListeningView>): ListeningView => ({
  playUri: "at://did:plc:a/fm.teal.feed.play/1",
  trackName: "Nobody",
  releaseName: "Be the Cowboy",
  playedTime: "2026-11-03T21:00:00Z",
  listeningNow: true,
  trackPlaysToday: 1,
  releasePlaysToday: 1,
  firstReleaseListen: false,
  reactions: [],
  ...over,
});

describe("today copy", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd",
    ]);
  });

  it("formats short times", () => {
    const now = Date.parse("2026-11-03T21:00:00Z");
    expect(shortAgo("2026-11-03T21:00:20Z", now)).toBe("now");
    expect(shortAgo("2026-11-03T20:48:00Z", now)).toBe("12m");
    expect(shortAgo("2026-11-03T18:00:00Z", now)).toBe("3h");
    expect(shortAgo("2026-11-01T21:00:00Z", now)).toBe("2d");
  });

  it("picks the most telling listening fact", () => {
    expect(listeningFact(listen({ firstReleaseListen: true }))).toBe("First time on Be the Cowboy");
    expect(listeningFact(listen({ releasePlaysToday: 9 }))).toBe("9th song from Be the Cowboy today");
    expect(listeningFact(listen({ trackPlaysToday: 4 }))).toBe("On repeat · 4 plays today");
    expect(listeningFact(listen({}))).toBeUndefined();
  });

  it("describes group moments", () => {
    const m: MomentView = {
      kind: "mutuals",
      release: { releaseName: "Romance" },
      listenerCount: 3,
      listeners: [{ displayName: "rhea" }, { displayName: "jo" }, { displayName: "sam" }] as MomentView["listeners"],
    };
    expect(momentLine(m)).toBe("rhea, jo and sam are on it right now");
    expect(momentLine({ ...m, kind: "network", listenerCount: 212 })).toBe("212 people listening right now");
    expect(momentLine({ ...m, kind: "trending", changePercent: 340, listenerCount: 18 })).toBe("+340% today · 18 listeners");
  });
});
