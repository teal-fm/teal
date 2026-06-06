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

export function listenHrefFromUri(uri?: string) {
  const parsed = parseAtUri(uri);
  if (!parsed || parsed.collection !== "fm.teal.alpha.feed.play") {
    return undefined;
  }
  return listenHref(parsed.did, parsed.rkey);
}

export function postHref(authorDid?: string, rkey?: string) {
  if (!authorDid || !rkey) return undefined;
  return `/post/${encodeURIComponent(authorDid)}/${encodeURIComponent(rkey)}`;
}

export function rkeyFromAtUri(uri?: string) {
  return uri?.split("/").pop();
}

export function postHrefFromUri(uri?: string) {
  const parsed = parseAtUri(uri);
  if (!parsed || parsed.collection !== "fm.teal.alpha.feed.social.post") {
    return undefined;
  }
  return postHref(parsed.did, parsed.rkey);
}

type ParsedAtUri = {
  did: string;
  collection?: string;
  rkey?: string;
};

export function parseAtUri(uri?: string): ParsedAtUri | undefined {
  if (!uri?.startsWith("at://")) return undefined;
  const rest = uri.slice("at://".length);
  const [did, collection, rkey] = rest.split("/");
  if (!did) return undefined;
  return { did, collection, rkey };
}

export function profileHrefFromAtUri(uri?: string) {
  const parsed = parseAtUri(uri);
  if (!parsed) return undefined;
  if (!parsed.collection) return `/profile/${encodeURIComponent(parsed.did)}`;
  if (
    parsed.collection === "fm.teal.alpha.actor.profile" ||
    parsed.collection === "app.bsky.actor.profile"
  ) {
    return `/profile/${encodeURIComponent(parsed.did)}`;
  }
  return undefined;
}

export function hrefFromAtUri(uri?: string) {
  return (
    listenHrefFromUri(uri) ||
    postHrefFromUri(uri) ||
    profileHrefFromAtUri(uri)
  );
}

export function playlistHref(name: string, uri: string) {
  return `/playlist/${routePart(name)}?uri=${encodeURIComponent(uri)}`;
}
