import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Stack, useRouter } from "expo-router";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  MusicBrainzRecording,
  ReleaseSelections,
  searchMusicbrainz,
  SearchParams,
  SearchResultProps,
} from "@/lib/oldStamp";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import SheetBackdrop from "@/components/ui/sheetBackdrop";

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
  const sheetRef = useRef<BottomSheetModal>(null);

  const currentRelease = selectedRelease || result.releases?.[0];

  const showModal = () => {
    sheetRef.current?.present();
  };

  const dismissModal = () => {
    sheetRef.current?.dismiss();
  };

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
          <Text className="font-bold text-sm line-clamp-2">{result.title}</Text>
          <Text className="text-sm text-gray-600">
            {result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist"}
          </Text>

          {/* Release Selector Button */}
          {result.releases && result.releases?.length > 0 && (
            <TouchableOpacity
              onPress={() => showModal()}
              className="p-1 bg-secondary/10 rounded-lg flex md:flex-row items-start md:items-center justify-between md:gap-1 w-full"
            >
              <View className="flex-1 flex md:flex-row items-start gap-1 overflow-hidden w-full">
                <Text className="text-sm text-gray-500 whitespace-nowrap">
                  Release:
                </Text>
                <Text className="text-sm line-clamp-1">
                  {currentRelease?.title}
                  {currentRelease?.date ? ` (${currentRelease.date})` : ""}
                  {currentRelease?.country
                    ? ` - ${currentRelease.country}`
                    : ""}
                </Text>
              </View>
              {/* the chevron looks odd in the other layout so I'm just hiding it for now. -mm */}
              <ChevronDown className="md:ml-1 md:block hidden w-6 h-6" />
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
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing={true}
        detached={true}
        backdropComponent={SheetBackdrop}
      >
        <View className="pb-4 border-b border-gray-200 -mt-2">
          <Text className="text-lg font-bold text-center">Select Release</Text>
          <TouchableOpacity
            className="absolute right-4 top-1.5"
            onPress={() => dismissModal()}
          >
            <Text className="text-primary">Done</Text>
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView className="bg-card min-h-64">
          {result.releases?.map((release) => (
            <TouchableOpacity
              key={release.id}
              className={`p-4 border-b border-gray-100 ${
                selectedRelease?.id === release.id ? "bg-primary/10" : ""
              }`}
              onPress={() => {
                onReleaseSelect(result.id, release);
                dismissModal();
              }}
            >
              <Text className="font-medium">{release.title}</Text>
              <View className="flex-row gap-2">
                {release.date && (
                  <Text className="text-sm text-gray-500">{release.date}</Text>
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
        </BottomSheetScrollView>
      </BottomSheetModal>
    </TouchableOpacity>
  );
}
