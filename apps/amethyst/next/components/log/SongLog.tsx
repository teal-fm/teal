import { useState } from "react";
import { Linking, Pressable, Switch, View } from "react-native";
import { Link } from "expo-router";
import { Check, ExternalLink, Search } from "lucide-react-native";
import { $validate as validatePlay } from "@teal/lexicons/src/fm/teal/feed/play";
import { createPlayRecordFromRecording } from "@/lib/manualListens";
import { searchMusicbrainz, type MusicBrainzRecording, type MusicBrainzRelease } from "@/lib/oldStamp";
import { crossPostListen, crossPostText } from "@/lib/teal/crosspost";
import { listenHrefFromUri } from "@/lib/teal/routes";
import { cn } from "@/lib/utils";
import { Button, ButtonRow, Cover, ErrorNotice, Field, Glass, Heading, Icon, Loading, Notice, Text } from "@/next/components/ds";
import { useStore } from "@/stores/mainStore";
import { retainConfirmedListens } from "@/stores/pendingListenStore";

const artistNames = (recording: MusicBrainzRecording) =>
  recording["artist-credit"]?.map((credit) => credit.name || credit.artist.name).join(", ") || "Unknown artist";

/** The edition to suggest first: the earliest worldwide or US release that isn't just the single. */
function suggestedRelease(recording: MusicBrainzRecording) {
  const releases = [...(recording.releases || [])].sort(
    (a, b) => (a.date || "ZZZ").localeCompare(b.date || "ZZZ") || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  return (
    releases.find((r) => (r.country === "XW" || r.country === "US") && r.title !== recording.title) ||
    releases.find((r) => r.title !== recording.title) ||
    releases[0]
  );
}

function Result({
  recording,
  chosen,
  onChoose,
}: {
  recording: MusicBrainzRecording;
  chosen: boolean;
  onChoose: (release?: MusicBrainzRelease) => void;
}) {
  const [release, setRelease] = useState(suggestedRelease(recording));
  const [showEditions, setShowEditions] = useState(false);
  const editions = recording.releases ?? [];
  return (
    <View className={cn("gap-2 rounded-[16px] p-3", chosen ? "bg-tint-soft" : "bg-fill")}>
      <Pressable
        role="radio"
        aria-checked={chosen}
        accessibilityLabel={`${recording.title} by ${artistNames(recording)}`}
        onPress={() => onChoose(release)}
        className="flex-row items-center gap-3"
      >
        <Cover releaseMbId={release?.id} size={52} radius={8} />
        <View className="min-w-0 flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {recording.title}
          </Text>
          <Text className="text-[14px] text-ink-2" numberOfLines={1}>
            {artistNames(recording)}
            {release ? ` · ${release.title}` : ""}
          </Text>
        </View>
        {chosen ? <Icon icon={Check} size={20} className="text-tint" /> : null}
      </Pressable>
      {editions.length > 1 ? (
        <Pressable accessibilityRole="button" aria-expanded={showEditions} onPress={() => setShowEditions((s) => !s)} className="self-start">
          <Text className="text-[13px] font-semibold text-tint">
            {showEditions ? "Hide editions" : `Choose from ${editions.length} editions`}
          </Text>
        </Pressable>
      ) : null}
      {showEditions ? (
        <View role="radiogroup" aria-label="Edition" className="gap-1">
          {editions.map((edition) => (
            <Pressable
              key={edition.id}
              role="radio"
              aria-checked={edition.id === release?.id}
              onPress={() => {
                setRelease(edition);
                onChoose(edition);
              }}
              className={cn("rounded-[10px] px-2.5 py-2", edition.id === release?.id && "bg-tint-soft")}
            >
              <Text className="text-[14px]" numberOfLines={1}>
                {edition.title}
              </Text>
              <Text className="text-[12px] text-ink-2">{[edition.date, edition.country, edition.status].filter(Boolean).join(" · ")}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type Saved = { listenUri: string; blueskyUrl?: string; crossPostFailed?: boolean };

/** Log one song you just heard: search MusicBrainz, pick the edition, and save it (optionally posting to Bluesky). */
export function SongLog() {
  const agent = useStore((state) => state.pdsAgent);
  const [fields, setFields] = useState({ track: "", artist: "", release: "" });
  const [results, setResults] = useState<MusicBrainzRecording[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [chosen, setChosen] = useState<MusicBrainzRecording | null>(null);
  const [crossPost, setCrossPost] = useState(false);
  const [postText, setPostText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  const set = (key: keyof typeof fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  const search = async () => {
    if (!fields.track.trim() && !fields.artist.trim() && !fields.release.trim()) return;
    setSearching(true);
    setSearchFailed(false);
    setChosen(null);
    try {
      setResults(await searchMusicbrainz(fields, { throwOnError: true }));
    } catch {
      setResults(null);
      setSearchFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const choose = (recording: MusicBrainzRecording, release?: MusicBrainzRelease) => {
    const next = { ...recording, selectedRelease: release };
    setChosen(next);
    setPostText(crossPostText(next));
    setError(null);
  };

  const save = async () => {
    if (!agent?.did || !chosen || saving) return;
    setSaving(true);
    setError(null);
    try {
      const record = createPlayRecordFromRecording(chosen);
      validatePlay(record);
      const res = await agent.call("com.atproto.repo.createRecord", {}, { repo: agent.did, collection: "fm.teal.feed.play", record });
      const { uri, cid } = res.data as { uri: string; cid: string };
      retainConfirmedListens(agent.did, [{ record, uri, cid }]);
      let result: Saved = { listenUri: uri };
      if (crossPost) {
        // The listen is saved; a failed cross-post must never prompt a second listen write.
        try {
          result = { ...result, blueskyUrl: await crossPostListen(agent, postText, chosen, artistNames(chosen)) };
        } catch {
          result = { ...result, crossPostFailed: true };
        }
      }
      setSaved(result);
    } catch {
      setError("Your listen didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSaved(null);
    setChosen(null);
    setResults(null);
    setFields({ track: "", artist: "", release: "" });
    setCrossPost(false);
  };

  if (saved) {
    const href = listenHrefFromUri(saved.listenUri);
    return (
      <Notice
        center
        icon={Check}
        title="Listen saved"
        body={
          saved.crossPostFailed
            ? "Your listen is saved, but the Bluesky post didn't go out."
            : "It's in your history now. Feeds can take a moment to catch up."
        }
        action={
          <ButtonRow>
            {href ? (
              <Link href={href as never} asChild>
                <Button label="See it" variant="secondary" />
              </Link>
            ) : null}
            {saved.blueskyUrl ? <Button label="Open on Bluesky" icon={ExternalLink} variant="secondary" onPress={() => Linking.openURL(saved.blueskyUrl!)} /> : null}
            <Button label="Log another" onPress={reset} />
          </ButtonRow>
        }
      />
    );
  }

  return (
    <View className="gap-4">
      <Glass className="gap-3 p-4">
        <Field label="Song" value={fields.track} onChangeText={set("track")} onSubmitEditing={search} returnKeyType="search" />
        <Field label="Artist" value={fields.artist} onChangeText={set("artist")} onSubmitEditing={search} returnKeyType="search" />
        <Field label="Album (optional)" value={fields.release} onChangeText={set("release")} onSubmitEditing={search} returnKeyType="search" />
        <Button label="Search" icon={Search} loading={searching} onPress={search} />
      </Glass>

      {searchFailed ? (
        <ErrorNotice title="MusicBrainz didn't answer" body="Search is unavailable for a moment. Try again." onRetry={search} />
      ) : searching ? (
        <Loading />
      ) : results && results.length === 0 ? (
        <Notice title="No songs found" body="Try fewer words, or check the spelling of the artist." />
      ) : results ? (
        <View role="radiogroup" aria-label="Song" className="gap-2">
          {results.map((recording) => (
            <Result key={recording.id} recording={recording} chosen={chosen?.id === recording.id} onChoose={(release) => choose(recording, release)} />
          ))}
        </View>
      ) : null}

      {chosen ? (
        <Glass strong className="gap-3 p-4">
          <Heading level={2} size="card">
            Save {chosen.title}
          </Heading>
          <Text className="text-[14px] text-ink-2">This listen uses the current time.</Text>
          <View className="flex-row items-center justify-between gap-3">
            <Text nativeID="crosspost-label" className="flex-1 font-semibold">
              Also post to Bluesky
            </Text>
            <Switch value={crossPost} onValueChange={setCrossPost} aria-labelledby="crosspost-label" />
          </View>
          {crossPost ? <Field label="Bluesky post" value={postText} onChangeText={setPostText} multiline maxLength={300} /> : null}
          {error ? (
            <Text role="alert" className="text-[14px] text-destructive">
              {error}
            </Text>
          ) : null}
          <Button label={saving ? "Saving" : "Save listen"} loading={saving} onPress={save} />
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://musicbrainz.org/recording/${chosen.id}`)} className="self-start">
            <Text className="text-[13px] text-ink-2">
              Missing details? <Text className="font-semibold text-tint">Fix them on MusicBrainz</Text>
            </Text>
          </Pressable>
        </Glass>
      ) : null}
    </View>
  );
}
