import React, { useState } from "react";
import {
  MusicBrainzRecording,
  ReleaseSelections,
  searchMusicbrainz,
  SearchParams,
  SearchResultProps,
} from "../../../../lib/oldStamp";
import {
  ScrollView,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Button } from "@/components/ui/button";
import { FlatList } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { Icon } from "@/lib/icons/iconWithClassName";

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

export function SearchResult({
  result,
  onSelectTrack,
  isSelected,
  selectedRelease,
  onReleaseSelect,
}: SearchResultProps) {
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
          <Text className="font-bold text-sm">{result.title}</Text>
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
        {/* <Link href={`https://musicbrainz.org/recording/${result.id}`}>
          <View className="bg-primary/40 rounded-full p-1">
            <Icon icon={Brain} size={20} />
          </View>
        </Link> */}
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
}
