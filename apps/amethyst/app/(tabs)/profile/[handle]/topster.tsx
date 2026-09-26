import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Share,
  useWindowDimensions,
  View,
} from "react-native";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  normalizeStatsPeriod,
  PROFILE_STATS_PERIODS,
} from "@/components/teal/ProfileStats";
import RightRail from "@/components/teal/RightRail";
import TealShell from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl, getProfile, getRepoTopReleases } from "@/lib/teal/api";
import { musicAlbumHref } from "@/lib/teal/routes";
import { ArrowLeft, Copy, Disc3, Download } from "lucide-react-native";

import type { ReleaseView } from "@teal/lexicons/src/types/fm/teal/stats/defs";

type GridSize = 3 | 4 | 5;
type ChartResult = {
  key: string;
  releases: ReleaseView[];
  displayName?: string;
  sourceCount?: number;
  albumPlayCount?: number;
  error?: string;
};

function normalizeGridSize(value: unknown): GridSize {
  return value === "3" || value === "4" || value === "5"
    ? (Number(value) as GridSize)
    : 4;
}

function AlbumTile({
  release,
  rank,
  size,
}: {
  release: ReleaseView;
  rank: number;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  const artwork = failed ? undefined : coverArtUrl(release.mbid, 250);
  const href = release.mbid
    ? musicAlbumHref("music", release.name || "Unknown album", release.mbid)
    : undefined;
  const content = (
    <Pressable
      accessibilityLabel={`#${rank} ${release.name || "Unknown album"}, ${release.playCount || 0} plays`}
      className="items-center justify-center overflow-hidden bg-[#244238] web:transition-opacity web:hover:opacity-80"
      style={{ width: size, height: size }}
    >
      {artwork ? (
        <Image
          source={{ uri: artwork }}
          className="h-full w-full"
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text className="font-accent text-4xl text-[#b4c7b7]">{rank}</Text>
      )}
    </Pressable>
  );
  return href ? (
    <Link href={href as any} asChild>
      {content}
    </Link>
  ) : (
    content
  );
}

export default function TopsterScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const actor = Array.isArray(params.handle) ? params.handle[0] : params.handle;
  const periodParam = Array.isArray(params.period)
    ? params.period[0]
    : params.period;
  const sizeParam = Array.isArray(params.size) ? params.size[0] : params.size;
  const period = normalizeStatsPeriod(periodParam);
  const columns = normalizeGridSize(sizeParam);
  const requestKey = `${actor || ""}:${period}:${columns}`;
  const [result, setResult] = useState<ChartResult>();
  const [actionMessage, setActionMessage] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);
  const isCompact = viewportWidth < 720;
  const gridWidth = Math.max(
    0,
    Math.floor(isCompact ? contentWidth : contentWidth * 0.63),
  );
  const gap = 4;
  const tileSize = gridWidth ? (gridWidth - gap * (columns - 1)) / columns : 0;
  const loading = Boolean(actor) && result?.key !== requestKey;
  const error = actor ? result?.error : "No listener was selected.";
  const visible = result?.key === requestKey ? result.releases : [];
  const periodLabel =
    PROFILE_STATS_PERIODS.find((item) => item.value === period)?.label ||
    "90 days";
  const title = `${result?.displayName || actor || "Listener"}'s top albums`;

  useEffect(() => {
    let active = true;
    if (!actor) return;
    Promise.all([
      getRepoTopReleases(actor, period, columns * columns),
      getProfile(actor).catch(() => undefined),
    ])
      .then(([stats, profile]) => {
        if (!active) return;
        setResult({
          key: requestKey,
          releases: stats.releases,
          sourceCount: stats.sourceCount,
          albumPlayCount: stats.albumPlayCount,
          displayName: profile?.profile.displayName || actor,
        });
      })
      .catch((cause) => {
        if (active)
          setResult({
            key: requestKey,
            releases: [],
            error: cause instanceof Error ? cause.message : String(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [actor, period, columns, requestKey]);

  function setChartParams(next: { period?: string; size?: string }) {
    setActionMessage(undefined);
    router.setParams(next);
  }

  async function shareChart() {
    if (!actor) return;
    const path = `/profile/${encodeURIComponent(actor)}/topster?period=${period}&size=${columns}`;
    const origin =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin
        : process.env.EXPO_PUBLIC_BASE_URL || "https://teal.fm";
    const url = `${origin.replace(/\/$/, "")}${path}`;
    try {
      if (Platform.OS === "web" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setActionMessage("Chart link copied.");
      } else {
        await Share.share({ message: url });
      }
    } catch {
      setActionMessage("Could not share the chart link.");
    }
  }

  async function downloadChart() {
    if (Platform.OS !== "web" || exporting) return;
    setExporting(true);
    setActionMessage(undefined);
    try {
      const { downloadTopsterPng } =
        await import("@/lib/teal/topsterExport.web");
      await downloadTopsterPng({
        releases: visible,
        columns,
        title,
        period: periodLabel,
      });
    } catch (cause) {
      setActionMessage(
        cause instanceof Error ? cause.message : "Could not download chart.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen
        options={{ title: "Top albums chart", headerShown: false }}
      />
      <View className="mb-7 gap-3">
        {actor && (
          <Link href={`/profile/${encodeURIComponent(actor)}` as any} asChild>
            <Pressable className="flex-row items-center gap-2 self-start py-1">
              <Icon icon={ArrowLeft} size={16} className="text-primary" />
              <Text className="text-sm text-primary">Back to profile</Text>
            </Pressable>
          </Link>
        )}
        <Text className="font-accent text-4xl text-foreground">
          Top albums chart
        </Text>
        <Text className="text-muted-foreground">
          A cover chart ranked by listens in this listener’s repository. Pick a period and a grid size
          to make it yours.
        </Text>
      </View>

      <View className="mb-5 gap-5 rounded-lg border border-border bg-card/70 p-4">
        <View className="gap-2">
          <Text className="font-sans font-bold">Listening period</Text>
          <View className="flex-row flex-wrap gap-2">
            {PROFILE_STATS_PERIODS.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={period === item.value ? "default" : "outline"}
                onPress={() => setChartParams({ period: item.value })}
              >
                <Text>{item.label}</Text>
              </Button>
            ))}
          </View>
        </View>
        <View className="gap-2">
          <Text className="font-sans font-bold">Grid size</Text>
          <View className="flex-row gap-2">
            {([3, 4, 5] as const).map((size) => (
              <Button
                key={size}
                size="sm"
                variant={columns === size ? "default" : "outline"}
                onPress={() => setChartParams({ size: String(size) })}
              >
                <Text>
                  {size} × {size}
                </Text>
              </Button>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View className="min-h-[20rem] items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <Text className="text-destructive">
            Could not load top albums: {error}
          </Text>
        </View>
      ) : visible.length === 0 ? (
        <View className="rounded-lg border border-border bg-card p-6">
          <Text className="font-sans text-xl font-bold">
            No albums for this period
          </Text>
          <Text className="mt-2 text-muted-foreground">
            This listener has no album plays here yet. Try a longer
            period.
          </Text>
        </View>
      ) : (
        <>
          <View className="mb-4 flex-row flex-wrap gap-2">
            <Button size="sm" variant="outline" onPress={shareChart}>
              <Icon icon={Copy} size={16} />
              <Text>Share link</Text>
            </Button>
            {Platform.OS === "web" && (
              <Button
                size="sm"
                variant="default"
                onPress={downloadChart}
                disabled={exporting}
              >
                <Icon icon={Download} size={16} />
                <Text>{exporting ? "Making PNG…" : "Download PNG"}</Text>
              </Button>
            )}
          </View>
          {actionMessage && (
            <Text className="mb-3 text-sm text-muted-foreground">
              {actionMessage}
            </Text>
          )}
          <Text className="mb-3 text-sm text-muted-foreground">
            {result?.albumPlayCount?.toLocaleString()} album plays counted from {result?.sourceCount?.toLocaleString()} repository listens in this period.
          </Text>
          <View
            className="rounded-lg bg-[#102621] p-4 md:p-5"
            onLayout={(event) =>
              setContentWidth(
                event.nativeEvent.layout.width - (isCompact ? 32 : 40),
              )
            }
          >
            <Text
              className="font-accent text-2xl text-[#f3eee2]"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="mb-4 mt-1 font-mono text-xs uppercase text-[#a8c7b9]">
              {periodLabel} · Top {visible.length} albums
            </Text>
            <View className={isCompact ? "gap-4" : "flex-row gap-4"}>
              <View
                className="flex-row flex-wrap"
                style={{ width: gridWidth, gap }}
              >
                {Array.from({ length: columns * columns }, (_, index) => {
                  const release = visible[index];
                  return release ? (
                    <AlbumTile
                      key={`${release.mbid || release.name}-${index}`}
                      release={release}
                      rank={index + 1}
                      size={tileSize}
                    />
                  ) : (
                    <View
                      key={`empty-${index}`}
                      accessibilityLabel={`Empty chart position ${index + 1}`}
                      className="bg-[#244238]"
                      style={{ width: tileSize, height: tileSize }}
                    />
                  );
                })}
              </View>
              <View className="min-w-0 flex-1 gap-1">
                {visible.map((release, index) => (
                  <View
                    key={`${release.mbid || release.name}-${index}`}
                    className="flex-row items-baseline gap-2"
                  >
                    <Text className="w-6 font-mono text-xs text-[#9fc7b7]">
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text
                      className="min-w-0 flex-1 text-sm text-[#f3eee2]"
                      numberOfLines={1}
                    >
                      {release.name || "Unknown album"}
                    </Text>
                    <Text className="font-mono text-xs text-[#9fc7b7]">
                      {release.playCount || 0}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View className="mt-4 flex-row items-center gap-2 border-t border-[#456156] pt-3">
              <Icon icon={Disc3} size={14} className="text-[#9fc7b7]" />
              <Text className="font-mono text-xs text-[#9fc7b7]">teal.fm</Text>
            </View>
          </View>
        </>
      )}
    </TealShell>
  );
}
