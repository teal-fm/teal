import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
} from "react-native";
import { Link, Redirect, Stack } from "expo-router";
import RightRail from "@/components/teal/RightRail";
import TealShell, { SectionHeading } from "@/components/teal/TealShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { coverArtUrl } from "@/lib/teal/api";
import { useStore } from "@/stores/mainStore";
import {
  AlertCircle,
  CalendarClock,
  Check,
  ChevronRight,
  Disc3,
  LoaderCircle,
  Search,
} from "lucide-react-native";

import {
  buildListenTimeline,
  buildManualListenRecords,
  effectiveDurationSeconds,
  formatDuration,
  getMusicBrainzRelease,
  type ListenTimestampMode,
  type MusicBrainzAlbumRelease,
  type MusicBrainzAlbumTrack,
  searchMusicBrainzReleases,
  submitManualListenRecords,
} from "@/lib/manualListens";

function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function releaseArtist(release: MusicBrainzAlbumRelease) {
  return release.artistCredit?.map((credit) => credit.name || credit.artist.name).join(", ") || "Unknown artist";
}

function releaseDetails(release: MusicBrainzAlbumRelease) {
  return [release.date?.slice(0, 4), release.country, release.status]
    .filter(Boolean)
    .join(" · ");
}

function flattenTracks(release: MusicBrainzAlbumRelease) {
  return (release.media || []).flatMap((medium) => medium.tracks || []);
}

function TrackRow({
  track,
  selected,
  onPress,
}: {
  track: MusicBrainzAlbumTrack;
  selected: boolean;
  onPress: () => void;
}) {
  const duration = effectiveDurationSeconds(track);
  const actualDuration = track.length ?? track.recording.length;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`flex-row items-center gap-3 border-b border-border px-3 py-3 web:transition-colors ${selected ? "bg-accent/60" : "web:hover:bg-accent/25"}`}
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background"}`}
      >
        {selected && <Check size={15} className="text-primary-foreground" />}
      </View>
      <Text className="w-8 font-mono text-xs text-muted-foreground">
        {track.number || track.position || "—"}
      </Text>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {track.recording.title || track.title || "Untitled track"}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {track.recording["artist-credit"]?.map((credit) => credit.name || credit.artist.name).join(", ") || "Album artist"}
        </Text>
      </View>
      <Text className="font-mono text-xs text-muted-foreground">
        {formatDuration(duration)}
        {!actualDuration && "*"}
      </Text>
    </Pressable>
  );
}

export default function ManualListensPage() {
  const status = useStore((state) => state.status);
  const agent = useStore((state) => state.pdsAgent);
  const [albumQuery, setAlbumQuery] = useState("");
  const [artistQuery, setArtistQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MusicBrainzAlbumRelease[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<MusicBrainzAlbumRelease>();
  const [tracks, setTracks] = useState<MusicBrainzAlbumTrack[]>([]);
  const [selectedTrackKeys, setSelectedTrackKeys] = useState<Set<string>>(new Set());
  const [timestampMode, setTimestampMode] = useState<ListenTimestampMode>("now");
  const [customStart, setCustomStart] = useState(localDateTimeValue());
  const [loading, setLoading] = useState(false);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number>();
  const [error, setError] = useState<string>();

  const selectedTracks = useMemo(
    () => tracks.filter((track) => selectedTrackKeys.has(track.key)),
    [selectedTrackKeys, tracks],
  );
  const customDate = parseLocalDateTime(customStart);
  const preview = useMemo(() => {
    if (selectedTracks.length === 0) return [];
    try {
      return buildListenTimeline(
        selectedTracks,
        timestampMode,
        customDate,
        new Date(),
      );
    } catch {
      return [];
    }
  }, [customDate, selectedTracks, timestampMode]);

  if (status === "start") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }
  if (status !== "loggedIn" || !agent) {
    return <Redirect href="/auth/login" />;
  }

  async function search() {
    if (!albumQuery.trim()) {
      setError("Enter an album name to search.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setHasSearched(true);
    setSelectedRelease(undefined);
    setTracks([]);
    setSelectedTrackKeys(new Set());
    setSubmittedCount(undefined);
    try {
      setSearchResults(await searchMusicBrainzReleases(albumQuery, artistQuery));
    } catch (searchError) {
      setSearchResults([]);
      setError(searchError instanceof Error ? searchError.message : "Album search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseRelease(release: MusicBrainzAlbumRelease) {
    setLoadingRelease(true);
    setError(undefined);
    try {
      const details = await getMusicBrainzRelease(release.id);
      const nextTracks = flattenTracks(details);
      if (nextTracks.length === 0) {
        throw new Error("MusicBrainz did not return any tracks for this release.");
      }
      setSelectedRelease(details);
      setTracks(nextTracks);
      setSelectedTrackKeys(new Set(nextTracks.map((track) => track.key)));
      setSubmittedCount(undefined);
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : "Could not load that release.");
    } finally {
      setLoadingRelease(false);
    }
  }

  function toggleTrack(key: string) {
    setSelectedTrackKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSubmittedCount(undefined);
  }

  function selectAllTracks() {
    setSelectedTrackKeys(new Set(tracks.map((track) => track.key)));
    setSubmittedCount(undefined);
  }

  function clearTracks() {
    setSelectedTrackKeys(new Set());
    setSubmittedCount(undefined);
  }

  async function submit() {
    if (!agent || !selectedRelease || selectedTracks.length === 0) {
      setError("Select at least one track.");
      return;
    }
    if (timestampMode === "custom" && !customDate) {
      setError("Enter a valid starting date and time.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const records = buildManualListenRecords(
        selectedRelease,
        selectedTracks,
        timestampMode,
        customDate,
        new Date(),
      );
      setSubmittedCount(await submitManualListenRecords(agent, records));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save these listens.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <TealShell rightRail={<RightRail />}>
      <Stack.Screen options={{ title: "Add listens", headerShown: false }} />
      <SectionHeading
        eyebrow="MANUAL LISTENING"
        title="Add an album"
      />
      <View className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <View className="border-b border-border bg-primary px-5 py-4">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-background/90">
              <Icon icon={Disc3} size={22} className="text-primary" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="mt-1 font-sans text-xl font-black text-primary-foreground">
                Put the needle down. We’ll place the tracks in time.
              </Text>
            </View>
          </View>
        </View>
        <View className="gap-3 p-5">
          <Input
            accessibilityLabel="Album name"
            placeholder="Album name"
            value={albumQuery}
            onChangeText={setAlbumQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <Input
            accessibilityLabel="Artist name"
            placeholder="Artist name (optional, but helps)"
            value={artistQuery}
            onChangeText={setArtistQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <Button onPress={search} disabled={loading} className="flex-row gap-2">
            {loading ? <LoaderCircle size={17} className="animate-spin text-primary-foreground" /> : <Search size={17} className="text-primary-foreground" />}
            <Text>{loading ? "Searching MusicBrainz…" : "Find album"}</Text>
          </Button>
        </View>
      </View>

      {error && (
        <View className="mb-5 flex-row gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle size={18} className="mt-0.5 text-destructive" />
          <Text className="flex-1 text-sm text-destructive">{error}</Text>
        </View>
      )}

      {searchResults.length > 0 && !selectedRelease && (
        <View className="mb-6 gap-3">
          <View className="flex-row items-end justify-between gap-3">
            <View>
              <Text className="font-mono text-[10px] font-bold uppercase tracking-[2px] text-primary">Choose a pressing</Text>
              <Text className="mt-1 text-sm text-muted-foreground">MusicBrainz has several releases for many albums.</Text>
            </View>
            <Text className="font-mono text-xs text-muted-foreground">{searchResults.length} results</Text>
          </View>
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            {searchResults.map((release) => (
              <Pressable
                key={release.id}
                onPress={() => chooseRelease(release)}
                className="flex-row items-center gap-3 border-b border-border p-3 last:border-b-0 web:hover:bg-accent/30"
              >
                <Image
                  source={{ uri: coverArtUrl(`mbid:${release.id}`, 250) }}
                  className="h-14 w-14 rounded-md bg-muted"
                />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold" numberOfLines={1}>{release.title}</Text>
                  <Text className="text-sm text-muted-foreground" numberOfLines={1}>{releaseArtist(release)}</Text>
                  <Text className="font-mono text-[10px] uppercase text-muted-foreground">{releaseDetails(release) || "Release details unavailable"}</Text>
                </View>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {hasSearched && !loading && searchResults.length === 0 && !error && (
        <View className="mb-6 items-center rounded-xl border border-dashed border-border bg-card p-8">
          <Disc3 size={28} className="mb-3 text-muted-foreground" />
          <Text className="font-semibold">No releases found</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Try a shorter album title, or add the artist name to narrow the search.
          </Text>
        </View>
      )}

      {loadingRelease && (
        <View className="mb-6 flex-row items-center justify-center gap-2 rounded-lg border border-border bg-card p-5">
          <ActivityIndicator />
          <Text className="text-sm text-muted-foreground">Loading tracklist…</Text>
        </View>
      )}

      {selectedRelease && tracks.length > 0 && (
        <View className="gap-5">
          <View className="overflow-hidden rounded-xl border border-border bg-card">
            <View className="flex-row gap-4 p-4">
              <Image
                source={{ uri: coverArtUrl(`mbid:${selectedRelease.id}`, 500) }}
                className="h-24 w-24 rounded-lg bg-muted"
              />
              <View className="min-w-0 flex-1 justify-center">
                <Text className="font-mono text-[10px] font-bold uppercase tracking-[2px] text-primary">Selected release</Text>
                <Text className="mt-1 font-sans text-2xl font-black" numberOfLines={2}>{selectedRelease.title}</Text>
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>{releaseArtist(selectedRelease)}</Text>
                <Text className="font-mono text-[10px] uppercase text-muted-foreground">{releaseDetails(selectedRelease)} · {tracks.length} tracks</Text>
              </View>
            </View>
            <View className="border-t border-border px-4 py-2">
              <Pressable
                onPress={() => {
                  setSelectedRelease(undefined);
                  setTracks([]);
                  setSelectedTrackKeys(new Set());
                  setSubmittedCount(undefined);
                }}
              >
                <Text className="text-xs font-bold text-primary">Choose a different release</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center justify-between border-t border-border bg-muted/30 px-4 py-2">
              <Text className="text-xs text-muted-foreground">{selectedTracks.length} of {tracks.length} selected</Text>
              <View className="flex-row gap-3">
                <Pressable onPress={selectAllTracks}><Text className="text-xs font-bold text-primary">Select all</Text></Pressable>
                <Pressable onPress={clearTracks}><Text className="text-xs font-bold text-muted-foreground">Clear</Text></Pressable>
              </View>
            </View>
            <View>
              {tracks.map((track) => (
                <TrackRow
                  key={track.key}
                  track={track}
                  selected={selectedTrackKeys.has(track.key)}
                  onPress={() => toggleTrack(track.key)}
                />
              ))}
            </View>
            <Text className="px-4 py-3 font-mono text-[10px] text-muted-foreground">* no duration in MusicBrainz; timing uses 3:00</Text>
          </View>

          <View className="rounded-xl border border-border bg-card p-5">
            <View className="mb-4 flex-row items-center gap-3">
              <CalendarClock size={20} className="text-primary" />
              <View>
                <Text className="font-semibold">When did you listen?</Text>
                <Text className="text-sm text-muted-foreground">Choose how to place the selected tracks in your listening history.</Text>
              </View>
            </View>
            <View className="mb-4 flex-row gap-2">
              {(["now", "custom"] as ListenTimestampMode[]).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setTimestampMode(mode)}
                  className={`flex-1 rounded-md border px-3 py-3 ${timestampMode === mode ? "border-primary bg-accent" : "border-border bg-background"}`}
                >
                  <Text className={timestampMode === mode ? "font-bold text-primary" : "font-semibold"}>{mode === "now" ? "Use current time" : "Choose a time"}</Text>
                  <Text className="mt-1 text-xs text-muted-foreground">{mode === "now" ? "Newest selected track starts now" : "First selected track starts at this time"}</Text>
                </Pressable>
              ))}
            </View>
            {timestampMode === "custom" && (
              <View className="gap-1">
                <Text className="text-sm font-semibold">First track start time</Text>
                <Text className="text-xs text-muted-foreground">Use your local date and time.</Text>
                <Input
                  accessibilityLabel="First track start date and time"
                  placeholder="e.g. 2026-07-18T20:30"
                  value={customStart}
                  onChangeText={setCustomStart}
                  inputMode="text"
                />
              </View>
            )}
            {preview.length > 0 && (
              <View className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                <Text className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[2px] text-primary">Preview</Text>
                <View className="gap-2">
                  {preview.map(({ track, playedTime }) => (
                    <View key={`${track.key}-${playedTime}`} className="flex-row items-center gap-3">
                      <Text className="w-8 font-mono text-[10px] text-muted-foreground">{track.number || track.position || "—"}</Text>
                      <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>{track.recording.title}</Text>
                      <Text className="font-mono text-[10px] text-muted-foreground">{new Date(playedTime).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <Button onPress={submit} disabled={submitting || selectedTracks.length === 0} className="mt-4 flex-row gap-2">
              {submitting ? <LoaderCircle size={17} className="animate-spin text-primary-foreground" /> : <Disc3 size={17} className="text-primary-foreground" />}
              <Text>{submitting ? "Saving listens…" : `Add ${selectedTracks.length} listen${selectedTracks.length === 1 ? "" : "s"}`}</Text>
            </Button>
          </View>
        </View>
      )}

      {submittedCount !== undefined && (
        <View className="mt-5 gap-3 rounded-xl border border-primary/30 bg-accent p-5">
          <Text className="font-sans text-2xl font-black">Listening history updated.</Text>
          <Text className="text-sm text-muted-foreground">Added {submittedCount} listen{submittedCount === 1 ? "" : "s"} as one atomic repository update.</Text>
          <View className="flex-row gap-3">
            <Link href={`/profile/${agent.did}` as any} asChild>
              <Button size="sm"><Text>View profile</Text></Button>
            </Link>
            <Button size="sm" variant="outline" onPress={() => setSubmittedCount(undefined)}><Text>Add another</Text></Button>
          </View>
        </View>
      )}
    </TealShell>
  );
}
