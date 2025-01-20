import React, { useState } from "react";
import {
  MusicBrainzRecording,
  ReleaseSelections,
  searchMusicbrainz,
  SearchParams,
  SearchResult,
} from "../../../../lib/oldStamp";
import { ScrollView, TextInput, View, Text } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { FlatList } from "react-native";
import { ChevronRight } from "lucide-react-native";

export default function StepOne() {
  const router = useRouter();
  const [selectedTrack, setSelectedTrack] =
    useState<MusicBrainzRecording | null>(null);

  const [searchFields, setSearchFields] = useState<SearchParams>({
    track: "",
    artist: "",
    release: "",
  });
  const [searchResults, setSearchResults] = useState<MusicBrainzRecording[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [releaseSelections, setReleaseSelections] = useState<ReleaseSelections>(
    {},
  );

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

  const clearSearch = () => {
    setSearchFields({ track: "", artist: "", release: "" });
    setSearchResults([]);
    setSelectedTrack(null);
  };

  return (
    <ScrollView className="flex-1 p-4 bg-background items-center">
      <Stack.Screen
        options={{
          title: "Stamp a play manually",
          headerBackButtonDisplayMode: "generic",
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
                  onSelectTrack={setSelectedTrack}
                  selectedRelease={releaseSelections[item.id]}
                  isSelected={selectedTrack?.id === item.id}
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
              onPress={() =>
                router.push({
                  pathname: "/stamp/submit",
                  params: { track: JSON.stringify(selectedTrack) },
                })
              }
              className="w-full flex flex-row align-middle"
            >
              <Text>{`Submit "${selectedTrack.title}" as Play`}</Text>
              <ChevronRight className="ml-2 inline" />
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
