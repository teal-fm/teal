import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";

import { appendTrackHistory, matchesTrack } from "../teal/trackHistory";

const selected: PlayView = {
  uri: "at://did:plc:owner/fm.teal.feed.play/self",
  trackName: "London Song",
  recordingMbId: "mbid:recording",
  releaseName: "Computer",
  artists: [{ artistName: "Ninajirachi" }],
};

it("finds recording identity even when edition or spelling changes", () => {
  expect(
    matchesTrack(
      {
        ...selected,
        recordingMbId: "recording" as PlayView["recordingMbId"],
        releaseName: "Other edition",
        trackName: "Other title",
      },
      selected,
    ),
  ).toBe(true);
});

it("does not mix similarly titled recordings when both identities exist", () => {
  expect(
    matchesTrack({ ...selected, recordingMbId: "mbid:other" }, selected),
  ).toBe(false);
});

it("keeps punctuation and non-Latin titles distinct in fallback matching", () => {
  const fallback = { ...selected, recordingMbId: undefined, trackName: "東京" };
  expect(matchesTrack({ ...fallback, trackName: "大阪" }, fallback)).toBe(
    false,
  );
  expect(matchesTrack({ ...fallback, trackName: " 東京 " }, fallback)).toBe(
    true,
  );
});

it("appends later album pages without repeating the selected listen or overlapping pages", () => {
  const first: PlayView = {
    ...selected,
    uri: "at://did:plc:owner/fm.teal.feed.play/first",
  };
  const second: PlayView = {
    ...selected,
    uri: "at://did:plc:owner/fm.teal.feed.play/second",
  };
  expect(
    appendTrackHistory(
      [first],
      [
        selected,
        first,
        second,
        second,
        {
          ...second,
          uri: "at://did:plc:owner/fm.teal.feed.play/unrelated",
          recordingMbId: "mbid:other",
        },
      ],
      selected,
    ),
  ).toEqual([first, second]);
});
