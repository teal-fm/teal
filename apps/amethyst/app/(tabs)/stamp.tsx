import {
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
} from "react-native";
import { useState } from "react";
import { useStore } from "../../stores/mainStore";
import { Button } from "../../components/ui/button";
import { Text } from "../../components/ui/text";
import { validateRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Brain, Check } from "lucide-react-native";
import { Link, Stack } from "expo-router";
import React from "react";

// MusicBrainz API Types
interface MusicBrainzArtistCredit {
  artist: {
    id: string;
    name: string;
    "sort-name"?: string;
  };
  joinphrase?: string;
  name: string;
}

interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  "track-count"?: number;
}

interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  isrcs?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
  selectedRelease?: MusicBrainzRelease; // Added for UI state
}

interface SearchParams {
  track?: string;
  artist?: string;
  release?: string;
}

interface SearchResultProps {
  result: MusicBrainzRecording;
  onSelectTrack: (track: MusicBrainzRecording | null) => void;
  isSelected: boolean;
  selectedRelease: MusicBrainzRelease | null;
  onReleaseSelect: (trackId: string, release: MusicBrainzRelease) => void;
}

interface PlayRecord {
  trackName: string;
  recordingMbId?: string;
  duration?: number;
  artistName: string;
  artistMbIds?: string[];
  releaseName?: string;
  releaseMbId?: string;
  isrc?: string;
  originUrl: string;
  musicServiceBaseDomain: string;
  submissionClientAgent: string;
  playedTime: string;
}

interface ReleaseSelections {
  [key: string]: MusicBrainzRelease;
}

async function searchMusicbrainz(
  searchParams: SearchParams,
): Promise<MusicBrainzRecording[]> {
  try {
    const queryParts: string[] = [];
    if (searchParams.track)
      queryParts.push(`release title:"${searchParams.track}"`);
    if (searchParams.artist)
      queryParts.push(`AND artist:"${searchParams.artist}"`);

    const query = queryParts.join(" AND ");

    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(
        query,
      )}&fmt=json`,
    );
    const data = await res.json();
    return data.recordings || [];
  } catch (error) {
    console.error("Failed to fetch MusicBrainz data:", error);
    return [];
  }
}

const SearchResult: React.FC<SearchResultProps> = ({
  result,
  onSelectTrack,
  isSelected,
  selectedRelease,
  onReleaseSelect,
}) => {
  const [showReleaseModal, setShowReleaseModal] = useState<boolean>(false);

  const currentRelease = selectedRelease || result.releases?.[0];

  return (
    <TouchableOpacity
      onPress={() => {
        onSelectTrack(
          isSelected
            ? null
            : {
                ...result,
                selectedRelease: currentRelease, // Pass the selected release with the track
              },
        );
      }}
      className={`p-4 mb-2 rounded-lg ${
        isSelected ? "bg-primary/20" : "bg-secondary/10"
      }`}
    >
      <View className="flex-row justify-between items-center gap-2">
        <Image
          className="w-16 h-16 rounded-lg bg-gray-500/50"
          source={{
            uri: `https://coverartarchive.org/release/${currentRelease?.id}/front-250`,
          }}
        />
        <View className="flex-1">
          <Text className="font-bold">{result.title}</Text>
          <Text className="text-sm text-gray-600">
            {result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist"}
          </Text>

          {/* Release Selector Button */}
          {result.releases && result.releases?.length > 0 && (
            <TouchableOpacity
              onPress={() => setShowReleaseModal(true)}
              className="p-1 bg-secondary/10 rounded-lg flex md:flex-row items-start md:gap-1"
            >
              <Text className="text-sm text-gray-500">Release:</Text>
              <Text className="text-sm" numberOfLines={1}>
                {currentRelease?.title}
                {currentRelease?.date ? ` (${currentRelease.date})` : ""}
                {currentRelease?.country ? ` - ${currentRelease.country}` : ""}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Existing icons */}
        <Link href={`https://musicbrainz.org/recording/${result.id}`}>
          <View className="bg-primary/40 rounded-full p-1">
            <Icon icon={Brain} size={20} />
          </View>
        </Link>
        {isSelected ? (
          <View className="bg-primary rounded-full p-1">
            <Icon icon={Check} size={20} />
          </View>
        ) : (
          <View className="border-2 border-secondary rounded-full p-3"></View>
        )}
      </View>

      {/* Release Selection Modal */}
      <Modal
        visible={showReleaseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReleaseModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl">
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-bold text-center">
                Select Release
              </Text>
              <TouchableOpacity
                className="absolute right-4 top-4"
                onPress={() => setShowReleaseModal(false)}
              >
                <Text className="text-primary">Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[50vh]">
              {result.releases?.map((release) => (
                <TouchableOpacity
                  key={release.id}
                  className={`p-4 border-b border-gray-100 ${
                    selectedRelease?.id === release.id ? "bg-primary/10" : ""
                  }`}
                  onPress={() => {
                    onReleaseSelect(result.id, release);
                    setShowReleaseModal(false);
                  }}
                >
                  <Text className="font-medium">{release.title}</Text>
                  <View className="flex-row gap-2">
                    {release.date && (
                      <Text className="text-sm text-gray-500">
                        {release.date}
                      </Text>
                    )}
                    {release.country && (
                      <Text className="text-sm text-gray-500">
                        {release.country}
                      </Text>
                    )}
                    {release.status && (
                      <Text className="text-sm text-gray-500">
                        {release.status}
                      </Text>
                    )}
                  </View>
                  {release.disambiguation && (
                    <Text className="text-sm text-gray-400 italic">
                      {release.disambiguation}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
};

export default function TabTwoScreen() {
  const agent = useStore((state) => state.pdsAgent);
  const [searchFields, setSearchFields] = useState<SearchParams>({
    track: "",
    artist: "",
    release: "",
  });
  const [searchResults, setSearchResults] = useState<MusicBrainzRecording[]>(
    [],
  );
  const [selectedTrack, setSelectedTrack] =
    useState<MusicBrainzRecording | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [releaseSelections, setReleaseSelections] = useState<ReleaseSelections>(
    {},
  );

  const handleTrackSelect = (track: MusicBrainzRecording | null): void => {
    setSelectedTrack(track);
  };

  const handleSearch = async (): Promise<void> => {
    if (!searchFields.track && !searchFields.artist && !searchFields.release) {
      return;
    }

    setIsLoading(true);
    setSelectedTrack(null);
    const results = await searchMusicbrainz(searchFields);
    setSearchResults(results);
    setIsLoading(false);
  };

  const createPlayRecord = (result: MusicBrainzRecording): PlayRecord => {
    return {
      trackName: result.title ?? "Unknown Title",
      recordingMbId: result.id ?? undefined,
      duration: result.length ? Math.floor(result.length / 1000) : undefined,
      artistName:
        result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist",
      artistMbIds: result["artist-credit"]?.[0]?.artist?.id
        ? [result["artist-credit"][0].artist.id]
        : undefined,
      releaseName: result.selectedRelease?.title ?? undefined,
      releaseMbId: result.selectedRelease?.id ?? undefined,
      isrc: result.isrcs?.[0] ?? undefined,
      originUrl: `https://tidal.com/browse/track/274816578?u`,
      musicServiceBaseDomain: "tidal.com",
      submissionClientAgent: "tealtracker/0.0.1b",
      playedTime: new Date().toISOString(),
    };
  };

  const submitPlay = async (): Promise<void> => {
    if (!selectedTrack) return;

    setIsSubmitting(true);
    const play = createPlayRecord(selectedTrack);

    try {
      let result = validateRecord(play);
      console.log("Validated play:", result);
      const res = await agent?.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.alpha.feed.play",
          rkey: undefined,
          record: play,
        },
      );
      console.log("Play submitted successfully:", res);
      // Reset after successful submission
      setSelectedTrack(null);
      setSearchResults([]);
      setSearchFields({ track: "", artist: "", release: "" });
    } catch (error) {
      console.error("Failed to submit play:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSearch = () => {
    setSearchFields({ track: "", artist: "", release: "" });
    setSearchResults([]);
    setSelectedTrack(null);
  };

  return (
    <ScrollView className="flex-1 p-4 bg-background items-center">
      <Stack.Screen
        options={{
          title: "Home",
          headerBackButtonDisplayMode: "minimal",
          headerShown: false,
        }}
      />
      {/* Search Form */}
      <View className="flex gap-4 max-w-screen-md w-screen px-4">
        <Text className="font-bold text-lg">Search for a track</Text>
        <TextInput
          className="p-2 border rounded-lg border-gray-300 bg-white"
          placeholder="Track name..."
          value={searchFields.track}
          onChangeText={(text) =>
            setSearchFields((prev) => ({ ...prev, track: text }))
          }
        />
        <TextInput
          className="p-2 border rounded-lg border-gray-300 bg-white"
          placeholder="Artist name..."
          value={searchFields.artist}
          onChangeText={(text) =>
            setSearchFields((prev) => ({ ...prev, artist: text }))
          }
        />
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            onPress={handleSearch}
            disabled={
              isLoading ||
              (!searchFields.track &&
                !searchFields.artist &&
                !searchFields.release)
            }
          >
            <Text>{isLoading ? "Searching..." : "Search"}</Text>
          </Button>
          <Button className="flex-1" onPress={clearSearch} variant="outline">
            <Text>Clear</Text>
          </Button>
        </View>
      </View>

      {/* Search Results */}
      <View className="flex gap-4 max-w-screen-md w-screen px-4">
        {searchResults.length > 0 && (
          <View className="mt-4">
            <Text className="text-lg font-bold mb-2">
              Search Results ({searchResults.length})
            </Text>
            <FlatList
              data={searchResults}
              renderItem={({ item }) => (
                <SearchResult
                  result={item}
                  onSelectTrack={handleTrackSelect}
                  isSelected={selectedTrack?.id === item.id}
                  selectedRelease={releaseSelections[item.id]}
                  onReleaseSelect={(trackId, release) => {
                    setReleaseSelections((prev) => ({
                      ...prev,
                      [trackId]: release,
                    }));
                  }}
                />
              )}
              keyExtractor={(item) => item.id}
            />
          </View>
        )}

        {/* Submit Button */}
        {selectedTrack && (
          <View className="mt-4 sticky bottom-0">
            <Button
              onPress={submitPlay}
              disabled={isSubmitting}
              className="w-full"
            >
              <Text>
                {isSubmitting
                  ? "Submitting..."
                  : `Submit "${selectedTrack.title}" as Play`}
              </Text>
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
