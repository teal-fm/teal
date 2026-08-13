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

export function musicArtistListenersHref(
  name: string,
  mbid?: string,
  period?: string,
) {
  const query = new URLSearchParams({ name });
  if (mbid) query.set("mbid", mbid);
  if (period) query.set("period", period);
  return `/:o/music/${routePart(name)}/listeners?${query.toString()}`;
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
  uri?: string,
  postUri?: string,
) {
  const query = new URLSearchParams();
  if (uri) query.set("uri", uri);
  if (postUri) query.set("postUri", postUri);
  const suffix = query.size ? `?${query.toString()}` : "";
  return `/:o/music/${routePart(artistName)}/${routePart(releaseName)}/${routePart(trackName)}${suffix}`;
}

export function listenHref(authorDid?: string, rkey?: string) {
  if (!authorDid || !rkey) return undefined;
  return `/listen/${encodeURIComponent(authorDid)}/${encodeURIComponent(rkey)}`;
}

export function listenHrefFromUri(uri?: string) {
  const parsed = parseAtUri(uri);
  if (!parsed || parsed.collection !== "fm.teal.feed.play") {
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
  if (!parsed || parsed.collection !== "fm.teal.feed.social.post") {
    return undefined;
  }
  return postHref(parsed.did, parsed.rkey);
}

type ParsedAtUri = {
  did: string;
  collection?: string;
  rkey?: string;
};

function decodePath(value: string) {
  let decoded = value;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function parseAtUri(uri?: string): ParsedAtUri | undefined {
  if (!uri?.startsWith("at://")) return undefined;
  const rest = uri.slice("at://".length);
  const [did, collection, rkey] = rest.split("/");
  if (!did) return undefined;
  return { did, collection, rkey };
}

export function atUriFromRoutePath(pathname?: string) {
  if (!pathname) return undefined;
  const path = decodePath(pathname);
  if (path.startsWith("/at://")) {
    return `at://${path.slice("/at://".length)}`;
  }
  if (path.startsWith("/at:/")) {
    return `at://${path.slice("/at:/".length)}`;
  }
  if (path.startsWith("at://")) {
    return path;
  }
  return undefined;
}

export function profileHrefFromAtUri(uri?: string) {
  const parsed = parseAtUri(uri);
  if (!parsed) return undefined;
  if (!parsed.collection) return `/profile/${encodeURIComponent(parsed.did)}`;
  if (
    parsed.collection === "fm.teal.actor.profile" ||
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
