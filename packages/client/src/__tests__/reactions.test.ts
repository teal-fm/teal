import { withViewerReaction } from "../teal/reactions";

describe("withViewerReaction", () => {
  const base = [
    { emoji: "🔥", count: 2 },
    { emoji: "😭", count: 1, viewerReaction: "at://me/r/1" },
  ];

  it("adds a new emoji with a count of one", () => {
    expect(withViewerReaction(base, "🫶", "at://me/r/2")).toEqual([
      ...base,
      { emoji: "🫶", count: 1, viewerReaction: "at://me/r/2" },
    ]);
  });

  it("counts the viewer once when reacting to an existing emoji", () => {
    expect(withViewerReaction(base, "🔥", "at://me/r/3")[0]).toEqual({
      emoji: "🔥",
      count: 3,
      viewerReaction: "at://me/r/3",
    });
  });

  it("keeps the count when a pending reaction is confirmed", () => {
    const pending = withViewerReaction(base, "🔥", "pending");
    expect(withViewerReaction(pending, "🔥", "at://me/r/4")[0].count).toBe(3);
  });

  it("drops an emoji when the viewer removes the last reaction", () => {
    expect(withViewerReaction(base, "😭", undefined)).toEqual([base[0]]);
  });
});

import { dedupeMoments } from "../teal/today";

describe("dedupeMoments", () => {
  it("keeps the first edition of an album that appears twice", () => {
    const m = (id: string, name: string, n: number) => ({
      release: { releaseMbId: id, releaseName: name, artistName: "Fontaines D.C." },
      listenerCount: n,
    });
    expect(
      dedupeMoments([m("a", "Dopamine Chamber", 3), m("b", "Le Tigre", 2), m("c", "dopamine chamber", 2)]).map(
        (x) => x.release.releaseMbId,
      ),
    ).toEqual(["a", "b"]);
  });
});
