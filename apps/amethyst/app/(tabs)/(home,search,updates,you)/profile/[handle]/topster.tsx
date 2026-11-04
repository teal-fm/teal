import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Link2 } from "lucide-react-native";
import { normalizeHandle } from "@/lib/teal/actors";
import { getProfile, getUserTopReleases } from "@/lib/teal/api";
import { absoluteUrl, musicAlbumHref } from "@/lib/teal/routes";
import { shareLink } from "@/lib/teal/share";
import { normalizePeriod, periodLabel, STATS_PERIODS } from "@/lib/teal/topStats";
import {
  AmbientSource,
  Button,
  ButtonRow,
  Choices,
  Cover,
  coverUri,
  ErrorNotice,
  Glass,
  Heading,
  Loading,
  Screen,
  Text,
  useLayout,
} from "@/components/ds";

type GridSize = 3 | 4 | 5;
const SIZES = [
  { value: 3, label: "3 × 3" },
  { value: 4, label: "4 × 4" },
  { value: 5, label: "5 × 5" },
] as const;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function gridSize(value?: string): GridSize {
  return value === "3" || value === "5" ? (Number(value) as GridSize) : 4;
}

/** A cover grid of someone's most-played albums, shareable as a link or a PNG. */
export default function TopsterScreen() {
  const params = useLocalSearchParams();
  const actor = param(params.handle) ?? "";
  const period = normalizePeriod(param(params.period));
  const columns = gridSize(param(params.size));
  const layout = useLayout();
  const [width, setWidth] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const chart = useQuery({
    queryKey: ["topster", actor, period, columns],
    queryFn: () => getUserTopReleases(actor, period, columns * columns).then((r) => r.releases),
    enabled: !!actor,
  });
  const profile = useQuery({
    queryKey: ["topster-name", actor],
    queryFn: () => getProfile(actor).then((r) => r.profile),
    enabled: !!actor,
  });
  const name = profile.data?.displayName || (actor.startsWith("did:") ? "Listener" : normalizeHandle(actor));
  const title = `${name}'s top albums`;
  const releases = chart.data ?? [];
  const gap = 4;
  const gridWidth = layout.phone ? width : Math.floor(width * 0.62);
  const tile = gridWidth ? (gridWidth - gap * (columns - 1)) / columns : 0;

  const set = (next: { period?: string; size?: string }) => {
    setNote(null);
    router.setParams(next);
  };

  const share = async () => {
    const result = await shareLink(title, absoluteUrl(`/profile/${encodeURIComponent(actor)}/topster?period=${period}&size=${columns}`));
    setNote(result === "copied" ? "Chart link copied." : result === "failed" ? "Couldn't share the chart." : null);
  };

  const download = async () => {
    if (Platform.OS !== "web" || exporting) return;
    setExporting(true);
    setNote(null);
    try {
      const { downloadTopsterPng } = await import("@/lib/teal/topsterExport.web");
      await downloadTopsterPng({ releases, columns, title, period: periodLabel(period) });
    } catch {
      setNote("The image didn't download. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen back title="Album chart" subtitle="Your most-played albums as a cover grid. Pick a period and size, then share it." width="wide">
      <Glass className="gap-4 p-4">
        <View className="gap-2">
          <Text className="text-[14px] font-semibold">Period</Text>
          <Choices label="Period" value={period} onChange={(value) => set({ period: value })} options={STATS_PERIODS} />
        </View>
        <View className="gap-2">
          <Text className="text-[14px] font-semibold">Grid</Text>
          <Choices label="Grid size" value={columns} onChange={(value) => set({ size: String(value) })} options={SIZES} />
        </View>
        <ButtonRow>
          <Button label="Share link" icon={Link2} variant="secondary" onPress={share} />
          {Platform.OS === "web" ? (
            <Button label={exporting ? "Making image" : "Download PNG"} icon={Download} loading={exporting} disabled={!releases.length} onPress={download} />
          ) : null}
        </ButtonRow>
        {note ? (
          <Text role="status" className="text-[14px] text-ink-2">
            {note}
          </Text>
        ) : null}
      </Glass>

      {chart.isLoading ? (
        <Loading />
      ) : chart.isError ? (
        <ErrorNotice title="Top albums didn't load" onRetry={() => chart.refetch()} />
      ) : (
        <Glass className="gap-3 p-4">
          <View>
            <Heading level={2}>{title}</Heading>
            <Text className="text-[14px] text-ink-2">
              {periodLabel(period)} · top {releases.length} {releases.length === 1 ? "album" : "albums"}
            </Text>
          </View>
          <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} className={layout.phone ? "gap-4" : "flex-row gap-5"}>
            <View className="flex-row flex-wrap" style={{ width: gridWidth, gap }}>
              {Array.from({ length: columns * columns }, (_, i) => {
                const release = releases[i];
                if (!release) {
                  return <View key={`empty-${i}`} aria-hidden className="rounded-[6px] bg-fill" style={{ width: tile, height: tile }} />;
                }
                const label = `${i + 1}. ${release.name || "Unknown album"}, ${release.playCount || 0} plays`;
                const art = (
                  <AmbientSource uri={coverUri(release.mbid)}>
                    <Cover releaseMbId={release.mbid} size={tile} radius={6} />
                  </AmbientSource>
                );
                return release.mbid ? (
                  <Link key={`${release.mbid}-${i}`} href={musicAlbumHref("music", release.name || "Unknown album", release.mbid) as never} asChild>
                    <Pressable accessibilityLabel={label} className="web:hover:opacity-85">
                      {art}
                    </Pressable>
                  </Link>
                ) : (
                  <View key={`${release.name}-${i}`} accessibilityLabel={label}>
                    {art}
                  </View>
                );
              })}
            </View>
            <View className="min-w-0 flex-1 gap-1.5">
              {releases.map((release, i) => (
                <View key={`${release.mbid || release.name}-${i}`} className="flex-row items-baseline gap-2">
                  <Text className="w-6 text-[13px] tabular-nums text-ink-2">{i + 1}</Text>
                  <Text className="min-w-0 flex-1 text-[15px]" numberOfLines={1}>
                    {release.name || "Unknown album"}
                  </Text>
                  <Text className="text-[13px] tabular-nums text-ink-2">{release.playCount || 0}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text className="text-[13px] text-ink-2">Counts reflect listens teal has received. Recent saves can take a moment to appear.</Text>
        </Glass>
      )}
    </Screen>
  );
}
