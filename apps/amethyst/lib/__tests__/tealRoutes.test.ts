import {
  atUriFromRoutePath,
  hrefFromAtUri,
  playlistHrefFromUri,
  postHrefFromUri,
  postUriFromRoute,
} from "../teal/routes";

it("opens a playlist AT URI with the required identity query intact", () => {
  const uri = "at://did:plc:owner/fm.teal.feed.social.playlist/3test";
  const href = hrefFromAtUri(
    atUriFromRoutePath(`/at:/${encodeURIComponent(uri.slice(5))}`),
  );
  expect(href).toBe(`/playlist/playlist?uri=${encodeURIComponent(uri)}`);
});

it.each([
  undefined,
  "at://did:plc:owner/fm.teal.feed.social.playlist",
  "at://did:plc:owner/fm.teal.feed.social.playlist/",
  "at://did:plc:owner/fm.teal.feed.social.playlistItem/3test",
  "at://did:plc:owner/fm.teal.feed.social.playlist/3test/extra",
])("does not route an incomplete or unrelated playlist URI: %s", (uri) => {
  expect(playlistHrefFromUri(uri)).toBeUndefined();
});

it("keeps existing listen redirects working", () => {
  expect(hrefFromAtUri("at://did:plc:owner/fm.teal.feed.play/3test")).toBe(
    "/listen/did%3Aplc%3Aowner/3test",
  );
});

it("routes alpha-era posts to the post page and back to their original URI", () => {
  const uri = "at://did:plc:owner/fm.teal.alpha.feed.social.post/3test";
  const href = postHrefFromUri(uri);
  expect(href).toBe("/post/did%3Aplc%3Aowner/3test?alpha=1");
  expect(postUriFromRoute("did:plc:owner", "3test", "1")).toBe(uri);
  expect(postUriFromRoute("did:plc:owner", "3test")).toBe(
    "at://did:plc:owner/fm.teal.feed.social.post/3test",
  );
});
