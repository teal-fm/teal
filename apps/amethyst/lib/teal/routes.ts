export function routePart(value?: string) {
  return encodeURIComponent(
    (value || "unknown")
      .toLowerCase()
      .replace(/^mbid:/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "unknown",
  );
}

export function musicArtistHref(name: string, mbid?: string) {
  const query = new URLSearchParams({ name });
  if (mbid) query.set("mbid", mbid);
  return `/:o/music/${routePart(name)}?${query.toString()}`;
}

export function musicAlbumHref(
  artistName: string,
  releaseName: string,
  releaseMbId: string,
) {
  return `/:o/music/${routePart(artistName)}/${routePart(releaseName)}?mbid=${encodeURIComponent(releaseMbId)}`;
}

export function musicTrackHref(
  artistName: string,
  releaseName: string | undefined,
  trackName: string,
  uri: string,
) {
  return `/:o/music/${routePart(artistName)}/${routePart(releaseName)}/${routePart(trackName)}?uri=${encodeURIComponent(uri)}`;
}

export function listenHref(authorDid?: string, rkey?: string) {
  if (!authorDid || !rkey) return undefined;
  return `/listen/${encodeURIComponent(authorDid)}/${encodeURIComponent(rkey)}`;
}

export function postHref(authorDid?: string, rkey?: string) {
  if (!authorDid || !rkey) return undefined;
  return `/post/${encodeURIComponent(authorDid)}/${encodeURIComponent(rkey)}`;
}

export function rkeyFromAtUri(uri?: string) {
  return uri?.split("/").pop();
}

export function postHrefFromUri(uri?: string) {
  if (!uri?.startsWith("at://")) return undefined;
  const [, rest] = uri.split("at://");
  const [did, collection, rkey] = rest.split("/");
  if (collection !== "fm.teal.alpha.feed.social.post") return undefined;
  return postHref(did, rkey);
}

export function playlistHref(name: string, uri: string) {
  return `/playlist/${routePart(name)}?uri=${encodeURIComponent(uri)}`;
}
