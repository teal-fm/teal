import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { Check, Search } from "lucide-react-native";
import {
  buildListenTimeline,
  buildManualListenRecords,
  effectiveDurationSeconds,
  flattenTracks,
  formatDuration,
  getMusicBrainzRelease,
  localDateTimeValue,
  parseLocalDateTime,
  releaseArtist,
  releaseDetails,
  searchMusicBrainzReleases,
  submitManualListenRecords,
  type ListenTimestampMode,
  type MusicBrainzAlbumRelease,
} from "@teal/client/manualListens";
import { cn } from "@teal/client/utils";
import { Button, ButtonRow, Choices, Cover, ErrorNotice, Field, Glass, Heading, Icon, Loading, Notice, Row, Text } from "@/components/ds";
import { useStore } from "@/stores/mainStore";
import { retainConfirmedListens } from "@teal/client/pendingListenStore";

const WHEN: readonly { value: ListenTimestampMode; label: string }[] = [
  { value: "now", label: "Just finished" },
  { value: "custom", label: "Started at a time" },
];

/** Log a whole album, or part of it: pick the edition, choose tracks, and say when you listened. */
export function AlbumLog() {
  const agent = useStore((state) => state.pdsAgent);
  const [album, setAlbum] = useState("");
  const [artist, setArtist] = useState("");
  const [results, setResults] = useState<MusicBrainzAlbumRelease[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [release, setRelease] = useState<MusicBrainzAlbumRelease | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ListenTimestampMode>("now");
  const [start, setStart] = useState(localDateTimeValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const tracks = useMemo(() => (release ? flattenTracks(release) : []), [release]);
  const chosen = tracks.filter((track) => selected.has(track.key));
  const startDate = parseLocalDateTime(start);
  const timeline = useMemo(() => {
    try {
      return chosen.length ? buildListenTimeline(chosen, mode, startDate, new Date()) : [];
    } catch {
      return [];
    }
  }, [chosen, mode, startDate]);

  const search = async () => {
    if (!album.trim()) return;
    setSearching(true);
    setSearchFailed(false);
    setRelease(null);
    try {
      setResults(await searchMusicBrainzReleases(album, artist));
    } catch {
      setResults(null);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const pick = async (candidate: MusicBrainzAlbumRelease) => {
    setLoadingRelease(true);
    setError(null);
    try {
      const details = await getMusicBrainzRelease(candidate.id);
      const list = flattenTracks(details);
      if (!list.length) throw new Error("no tracks");
      setRelease(details);
      setSelected(new Set(list.map((t) => t.key)));
      setSavedCount(null);
    } catch {
      setError("That edition didn't load its tracks. Try another one.");
    } finally {
      setLoadingRelease(false);
    }
  };

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    if (!agent || !release || !chosen.length || saving) return;
    if (mode === "custom" && !startDate) {
      setError("Enter a valid start date and time.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const records = buildManualListenRecords(release, chosen, mode, startDate, new Date());
      setSavedCount(await submitManualListenRecords(agent, records, (writes) => agent.did && retainConfirmedListens(agent.did, writes)));
    } catch {
      setError("Your listens didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (savedCount !== null && release) {
    return (
      <Notice
        center
        icon={Check}
        title={`${savedCount} ${savedCount === 1 ? "listen" : "listens"} saved`}
        body={`${release.title} is in your history now.`}
        action={
          <ButtonRow>
            {agent?.did ? (
              <Link href={`/profile/${agent.did}?tab=listening`} asChild>
                <Button label="See your history" variant="secondary" />
              </Link>
            ) : null}
            <Button
              label="Log another album"
              onPress={() => {
                setSavedCount(null);
                setRelease(null);
                setResults(null);
                setAlbum("");
                setArtist("");
              }}
            />
          </ButtonRow>
        }
      />
    );
  }

  return (
    <View className="gap-4">
      <Glass className="gap-3 p-4">
        <Field label="Album" value={album} onChangeText={setAlbum} onSubmitEditing={search} returnKeyType="search" />
        <Field label="Artist (optional)" value={artist} onChangeText={setArtist} onSubmitEditing={search} returnKeyType="search" />
        <Button label="Search" icon={Search} loading={searching} disabled={!album.trim()} onPress={search} />
      </Glass>

      {searchFailed ? (
        <ErrorNotice title="MusicBrainz didn't answer" body="Album search is unavailable for a moment. Try again." onRetry={search} />
      ) : searching ? (
        <Loading />
      ) : results && !release ? (
        results.length === 0 ? (
          <Notice title="No albums found" body="Try the album's exact title, or add the artist." />
        ) : (
          <Glass className="px-4 py-1">
            <Heading level={2} size="card" className="pt-3">
              Choose an edition
            </Heading>
            {results.map((candidate, i) => (
              <Row
                key={candidate.id}
                onPress={() => pick(candidate)}
                leading={<Cover releaseMbId={candidate.id} size={48} radius={8} />}
                title={candidate.title}
                subtitle={releaseArtist(candidate)}
                meta={releaseDetails(candidate)}
                divider={i < results.length - 1}
              />
            ))}
          </Glass>
        )
      ) : null}
      {loadingRelease ? <Loading /> : null}

      {release ? (
        <Glass strong className="gap-3 p-4">
          <View className="flex-row items-center gap-3">
            <Cover releaseMbId={release.id} size={64} radius={10} />
            <View className="min-w-0 flex-1">
              <Heading level={2} size="card" numberOfLines={2}>
                {release.title}
              </Heading>
              <Text className="text-[14px] text-ink-2">{releaseArtist(release)}</Text>
            </View>
            <Button label="Change" size="sm" variant="plain" onPress={() => setRelease(null)} />
          </View>
          <ButtonRow>
            <Button label="Select all" size="sm" variant="secondary" onPress={() => setSelected(new Set(tracks.map((t) => t.key)))} />
            <Button label="Clear" size="sm" variant="secondary" onPress={() => setSelected(new Set())} />
            <Text className="text-[14px] tabular-nums text-ink-2">
              {chosen.length} of {tracks.length}
            </Text>
          </ButtonRow>
          <View className="gap-0.5">
            {tracks.map((track) => {
              const on = selected.has(track.key);
              return (
                <Pressable
                  key={track.key}
                  role="checkbox"
                  aria-checked={on}
                  onPress={() => toggle(track.key)}
                  className={cn("flex-row items-center gap-3 rounded-[10px] px-2 py-2", on && "bg-tint-soft")}
                >
                  <View className={cn("h-5 w-5 items-center justify-center rounded-full border-2", on ? "border-tint bg-tint" : "border-hair")}>
                    {on ? <Icon icon={Check} size={12} className="text-on-tint" /> : null}
                  </View>
                  <Text className="w-6 text-[13px] tabular-nums text-ink-2">{track.number || track.position || ""}</Text>
                  <Text className="min-w-0 flex-1" numberOfLines={1}>
                    {track.recording.title || track.title || "Untitled track"}
                  </Text>
                  <Text className="text-[13px] tabular-nums text-ink-2">{formatDuration(effectiveDurationSeconds(track))}</Text>
                </Pressable>
              );
            })}
          </View>
          <View className="gap-2">
            <Text className="font-semibold">When did you listen?</Text>
            <Choices label="When did you listen?" value={mode} onChange={setMode} options={WHEN} />
            {mode === "custom" ? (
              <Field label="Started at" hint="Local time, like 2026-11-04T18:30." value={start} onChangeText={setStart} autoCapitalize="none" />
            ) : null}
            {timeline.length ? (
              <Text className="text-[13px] text-ink-2">
                First listen {new Date(timeline[0].playedTime).toLocaleString()}, last {new Date(timeline[timeline.length - 1].playedTime).toLocaleString()}.
              </Text>
            ) : null}
          </View>
          {error ? (
            <Text role="alert" className="text-[14px] text-destructive">
              {error}
            </Text>
          ) : null}
          <Button
            label={saving ? "Saving" : `Save ${chosen.length} ${chosen.length === 1 ? "listen" : "listens"}`}
            loading={saving}
            disabled={!chosen.length}
            onPress={save}
          />
        </Glass>
      ) : null}
    </View>
  );
}
