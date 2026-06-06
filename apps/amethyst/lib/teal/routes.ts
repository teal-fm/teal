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

export function playlistHref(name: string, uri: string) {
  return `/playlist/${routePart(name)}?uri=${encodeURIComponent(uri)}`;
}
