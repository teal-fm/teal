import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Check, Search } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { searchMusicbrainz } from "@/lib/oldStamp";
import { displayArtists, getActorFeed } from "@/lib/teal/api";
import { musicBrainzToPlayView } from "@/lib/teal/compose";
import { useViewerDid } from "@/lib/teal/queries";
import { cn } from "@/lib/utils";
import { Button, Cover, Field, Icon, Loading, Text } from "@/components/ds";

function TrackOption({ play, selected, onPress }: { play: PlayView; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={`${play.trackName} by ${displayArtists(play) || "Unknown artist"}`}
      onPress={onPress}
      className={cn(
        "flex-row items-center gap-3 rounded-[14px] border p-2.5 active:opacity-70",
        selected ? "border-tint bg-tint-soft" : "border-transparent",
      )}
    >
      <Cover releaseMbId={play.releaseMbId} size={44} radius={8} />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {play.trackName}
        </Text>
        <Text className="text-[14px] text-ink-2" numberOfLines={1}>
          {[displayArtists(play) || "Unknown artist", play.releaseName].filter(Boolean).join(" · ")}
        </Text>
      </View>
      {selected ? <Icon icon={Check} size={18} className="text-tint" /> : null}
    </Pressable>
  );
}

/** Choose the song for a post: something you played recently, or anything on MusicBrainz. */
export function TrackPicker({
  selected,
  onSelect,
  autoSelect,
}: {
  selected: PlayView | null;
  onSelect: (play: PlayView) => void;
  /** Start on the most recent play when nothing is chosen yet. */
  autoSelect?: boolean;
}) {
  const viewer = useViewerDid();
  const recent = useQuery({
    queryKey: ["actor-plays-recent", viewer],
    queryFn: () => getActorFeed(viewer!, 20).then((r) => r.plays),
    enabled: !!viewer,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayView[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (autoSelect && !selected && recent.data?.[0]) onSelect(recent.data[0]);
  }, [autoSelect, recent.data, selected, onSelect]);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(false);
    try {
      const found = await searchMusicbrainz({ track: q, artist: "", release: "" }, { throwOnError: true });
      setResults(found.slice(0, 8).map((r) => musicBrainzToPlayView(r)));
    } catch {
      setError(true);
    } finally {
      setSearching(false);
    }
  };

  const list = results ?? recent.data ?? [];
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <Field
            label="Find a song"
            hideLabel
            placeholder="Search for any song"
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              if (!value.trim()) setResults(null);
            }}
            onSubmitEditing={search}
            returnKeyType="search"
          />
        </View>
        <Button label="Search" icon={Search} variant="secondary" loading={searching} onPress={search} />
      </View>
      <Text className="text-[13px] font-semibold text-ink-2">{results ? "Search results" : "Played recently"}</Text>
      {error ? (
        <Text role="alert" className="text-[14px] text-destructive">
          Search didn't go through. Try again.
        </Text>
      ) : null}
      {recent.isLoading && !results ? (
        <Loading className="py-6" />
      ) : list.length === 0 ? (
        <Text className="text-[14px] text-ink-2">{results ? "No songs found." : "Search for the song you want to post."}</Text>
      ) : (
        <View role="radiogroup" aria-label="Song" className="gap-1">
          {list.map((play, i) => (
            <TrackOption
              key={`${play.uri ?? play.recordingMbId ?? play.trackName}-${i}`}
              play={play}
              selected={!!selected && (selected.uri ?? selected.recordingMbId) === (play.uri ?? play.recordingMbId)}
              onPress={() => onSelect(play)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
