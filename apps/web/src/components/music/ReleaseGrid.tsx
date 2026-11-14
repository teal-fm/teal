import type { AlbumSummary } from "@teal/lexicons/src/fm/teal/music/defs";
import { countLabel } from "@teal/client/teal/music";
import { musicAlbumHref } from "@teal/client/teal/routes";
import { A, AmbientSource, Cover, coverUri } from "~/ds";

/** A grid of releases, each tinting the backdrop as it scrolls past. */
export function ReleaseGrid({ releases }: { releases: readonly AlbumSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-[4%] gap-y-4 sm:grid-cols-3">
      {releases.map((release) => (
        <li key={release.mbid}>
          <A href={musicAlbumHref(release.artistName, release.name, release.mbid)} className="block hover:opacity-85">
            <AmbientSource uri={coverUri(release.mbid)}>
              <Cover releaseMbId={release.mbid} radius={14} className="shadow-lg" />
            </AmbientSource>
            <p className="mt-2 line-clamp-2 text-[15px] font-semibold text-ink">{release.name}</p>
            <p className="text-[13px] tabular-nums text-ink-2">{countLabel(release.playCount, "listen")}</p>
          </A>
        </li>
      ))}
    </ul>
  );
}
