import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Link2 } from "lucide-react";
import { normalizeHandle } from "@teal/client/teal/actors";
import { getProfile, getUserTopReleases } from "@teal/client/teal/api";
import { absoluteUrl, musicAlbumHref } from "@teal/client/teal/routes";
import { normalizePeriod, periodLabel, STATS_PERIODS } from "@teal/client/teal/topStats";
import { cn } from "@teal/client/utils";
import { A, AmbientSource, Button, ButtonRow, Choices, Cover, coverUri, ErrorNotice, Glass, Heading, Loading, Screen } from "~/ds";
import { shareLink } from "~/components/today/share";
import { pickStrings } from "~/lib/search";

type GridSize = 3 | 4 | 5;
const SIZES = [
  { value: 3, label: "3 × 3" },
  { value: 4, label: "4 × 4" },
  { value: 5, label: "5 × 5" },
] as const;

function gridSize(value?: string): GridSize {
  return value === "3" || value === "5" ? (Number(value) as GridSize) : 4;
}

export const Route = createFileRoute("/profile/$handle/topster")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "period", "size"),
  head: () => ({ meta: [{ title: "Album chart · Teal" }] }),
  component: TopsterScreen,
});

/** A cover grid of someone's most-played albums, shareable as a link or a PNG. */
function TopsterScreen() {
  const { handle: actor } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const period = normalizePeriod(search.period);
  const columns = gridSize(search.size);
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const chart = useQuery({
    queryKey: ["topster", actor, period, columns],
    queryFn: () => getUserTopReleases(actor, period, columns * columns).then((r) => r.releases),
  });
  const profile = useQuery({
    queryKey: ["topster-name", actor],
    queryFn: () => getProfile(actor).then((r) => r.profile),
  });
  const name = profile.data?.displayName || normalizeHandle((profile.data as { handle?: string } | undefined)?.handle) || normalizeHandle(actor);
  const title = `${name}'s top albums`;
  const releases = chart.data ?? [];

  const set = (next: { period?: string; size?: string }) => {
    setNote(null);
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });
  };

  const share = async () => {
    const result = await shareLink(title, absoluteUrl(`/profile/${encodeURIComponent(actor)}/topster?period=${period}&size=${columns}`));
    setNote(result === "copied" ? "Chart link copied." : result === "failed" ? "Couldn't share the chart." : null);
  };

  const download = async () => {
    if (exporting) return;
    setExporting(true);
    setNote(null);
    try {
      const { downloadTopsterPng } = await import("~/lib/topsterExport");
      await downloadTopsterPng({ releases, columns, title, period: periodLabel(period) });
    } catch {
      setNote("The image didn't download. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen back title="Album chart" subtitle="Most-played albums as a cover grid. Pick a period and size, then share it." width="wide">
      <Glass className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">Period</p>
          <Choices label="Period" value={period} onChange={(value) => set({ period: value })} options={STATS_PERIODS} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">Grid</p>
          <Choices label="Grid size" value={columns} onChange={(value) => set({ size: String(value) })} options={SIZES} />
        </div>
        <ButtonRow>
          <Button label="Share link" icon={Link2} variant="secondary" onClick={share} />
          <Button label={exporting ? "Making image" : "Download PNG"} icon={Download} loading={exporting} disabled={!releases.length} onClick={download} />
        </ButtonRow>
        {note ? (
          <p role="status" className="text-[14px] text-ink-2">
            {note}
          </p>
        ) : null}
      </Glass>

      {chart.isLoading ? (
        <Loading />
      ) : chart.isError ? (
        <ErrorNotice title="Top albums didn't load" onRetry={() => chart.refetch()} />
      ) : (
        <Glass as="section" className="flex flex-col gap-3 p-4">
          <div>
            <Heading level={2}>{title}</Heading>
            <p className="text-[14px] text-ink-2">
              {periodLabel(period)} · top {releases.length} {releases.length === 1 ? "album" : "albums"}
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="grid w-full gap-1 sm:w-[62%] sm:shrink-0" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
              {Array.from({ length: columns * columns }, (_, i) => {
                const release = releases[i];
                if (!release) return <span key={`empty-${i}`} aria-hidden className="aspect-square rounded-[6px] bg-fill" />;
                const label = `${i + 1}. ${release.name || "Unknown album"}, ${release.playCount || 0} plays`;
                const art = (
                  <AmbientSource uri={coverUri(release.mbid)}>
                    <Cover releaseMbId={release.mbid} radius={6} />
                  </AmbientSource>
                );
                return release.mbid ? (
                  <A key={`${release.mbid}-${i}`} href={musicAlbumHref("music", release.name || "Unknown album", release.mbid)} aria-label={label} className="hover:opacity-85">
                    {art}
                  </A>
                ) : (
                  <div key={`${release.name}-${i}`} aria-label={label} role="img">
                    {art}
                  </div>
                );
              })}
            </div>
            <ol className="flex min-w-0 flex-1 flex-col gap-1.5">
              {releases.map((release, i) => (
                <li key={`${release.mbid || release.name}-${i}`} className="flex items-baseline gap-2">
                  <span className="w-6 text-[13px] tabular-nums text-ink-2">{i + 1}</span>
                  <span className={cn("min-w-0 flex-1 truncate text-[15px]")}>{release.name || "Unknown album"}</span>
                  <span className="text-[13px] tabular-nums text-ink-2">{release.playCount || 0}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-[13px] text-ink-2">Counts reflect listens teal has received. Recent saves can take a moment to appear.</p>
        </Glass>
      )}
    </Screen>
  );
}
