import { richTextSegments } from "../richText";

const facet = (byteStart: number, byteEnd: number, feature: { did?: string; uri?: string }) => ({
  index: { byteStart, byteEnd },
  features: [feature],
});

it("splits mentions and links by UTF-8 byte offsets", () => {
  // "é" is two bytes, so the mention starts at byte 6, character 5.
  expect(richTextSegments("café @jo hi", [facet(6, 9, { did: "did:plc:jo" })])).toEqual([
    { text: "café " },
    { text: "@jo", mentionDid: "did:plc:jo" },
    { text: " hi" },
  ]);
});

it("shows non-http links and overlapping facets as plain text", () => {
  expect(
    richTextSegments("ab cd", [facet(0, 2, { uri: "javascript:alert(1)" }), facet(1, 5, { uri: "https://x.test" })]),
  ).toEqual([{ text: "ab" }, { text: " cd" }]);
});

it("returns the whole text without facets", () => {
  expect(richTextSegments("plain")).toEqual([{ text: "plain" }]);
  expect(richTextSegments("")).toEqual([]);
});
