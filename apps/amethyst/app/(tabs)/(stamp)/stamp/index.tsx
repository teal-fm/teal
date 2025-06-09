import React, { useContext, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { Link, Stack, useRouter } from "expo-router";
import { ExternalLink } from "@/components/ExternalLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SheetBackdrop, { SheetHandle } from "@/components/ui/sheetBackdrop";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  MusicBrainzRecording,
  MusicBrainzRelease,
  ReleaseSelections,
  searchMusicbrainz,
  SearchParams,
  SearchResultProps,
} from "@/lib/oldStamp";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";

import { StampContext, StampContextValue, StampStep } from "./_layout";

export default function StepOne() {
  const router = useRouter();
  const ctx = useContext(StampContext);
  const { state, setState } = ctx as StampContextValue;
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

  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // reset search state if requested
  useEffect(() => {
    if (state.step === StampStep.IDLE && state.resetSearchState) {
      setSearchFields({ track: "", artist: "", release: "" });
      setSearchResults([]);
      setSelectedTrack(null);
      setReleaseSelections({});
    }
  }, [state]);

  const handleSearch = async (): Promise<void> => {
    if (!searchFields.track && !searchFields.artist && !searchFields.release) {
      return;
    }

    setIsLoading(true);
    setSelectedTrack(null);
    const results = await searchMusicbrainz(searchFields);
    setSearchResults(results);
    setIsLoading(false);
    setHasSearched(true);
  };

  const clearSearch = () => {
    setSearchFields({ track: "", artist: "", release: "" });
    setSearchResults([]);
    setSelectedTrack(null);
  };

  return (
    <ScrollView className="w-min flex-1 items-center justify-start bg-background pt-2">
      <Stack.Screen
        options={{
          title: "Stamp a play manually",
          headerBackButtonDisplayMode: "generic",
        }}
      />
      {/* Search Form */}
      <View className="flex gap-2 max-w-2xl w-screen px-4">
        <Text className="font-bold text-lg">Search for a track</Text>
        <Input
          placeholder="Track name..."
          value={searchFields.track}
          onChangeText={(text) =>
            setSearchFields((prev) => ({ ...prev, track: text }))
          }
          onKeyPress={(e) => {
            if (e.nativeEvent.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Input
          placeholder="Artist name..."
          value={searchFields.artist}
          onChangeText={(text) =>
            setSearchFields((prev) => ({ ...prev, artist: text }))
          }
          onKeyPress={(e) => {
            if (e.nativeEvent.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <Input
          placeholder="Album name..."
          value={searchFields.release}
          onChangeText={(text) =>
            setSearchFields((prev) => ({ ...prev, release: text }))
          }
          onKeyPress={(e) => {
            if (e.nativeEvent.key === "Enter") {
              handleSearch();
            }
          }}
        />
        <View className="flex-row gap-2 mt-2">
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
      <View className="flex w-screen max-w-2xl gap-4 px-4">
        {searchResults.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-2 text-lg font-bold">
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
        ) : (
          hasSearched && (
            <View className="mt-4">
              <Text className="mb-2 text-center text-lg text-muted-foreground">
                No search results found.
              </Text>
              <Text className="mb-2 text-center text-lg text-muted-foreground">
                Please try importing with{" "}
                <ExternalLink
                  href="https://harmony.pulsewidth.org.uk/"
                  className="border-b border-muted-foreground/60 text-bsky"
                >
                  Harmony
                </ExternalLink>{" "}
                or manually on{" "}
                <ExternalLink
                  href="https://musicbrainz.org/release/add"
                  className="border-b border-muted-foreground/60 text-bsky"
                >
                  Musicbrainz
                </ExternalLink>
                .
              </Text>
            </View>
          )
        )}

        {/* Submit Button */}
        {selectedTrack && (
          <View className="sticky bottom-0 mt-4">
            <Button
              onPress={() => {
                setState({
                  step: StampStep.SUBMITTING,
                  submittingStamp: selectedTrack,
                });
                router.push({
                  pathname: "/stamp/submit",
                });
              }}
              className="flex w-full flex-row align-middle"
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

// Get 'best' release from MusicBrainz releases
// 1. Sort releases by date (put non-released dates at the end)
// 2. Return the oldest release where country is 'XW' or 'US' that is NOT the name of the track
// 3. If none, return oldest release that is NOT the name of the track
// 4. Return the oldest release.
function getBestRelease(releases: MusicBrainzRelease[], trackTitle: string) {
  if (!releases || releases.length === 0) return null;
  if (releases.length === 1) return releases[0];

  releases.sort(
    (a, b) =>
      a.date?.localeCompare(b.date || "ZZZ") ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );

  let bestRelease = releases.find(
    (release) =>
      (release.country === "XW" || release.country === "US") &&
      release.title !== trackTitle,
  );
  if (!bestRelease)
    bestRelease = releases.find((release) => release.title !== trackTitle);

  if (!bestRelease) {
    console.log(
      "Could not find a suitable release for",
      trackTitle,
      "picking",
      releases[0]?.title,
    );
    bestRelease = releases[0];
  }

  return bestRelease;
}

export function SearchResult({
  result,
  onSelectTrack,
  isSelected,
  selectedRelease,
  onReleaseSelect,
}: SearchResultProps) {
  const sheetRef = useRef<BottomSheetModal>(null);

  const currentRelease =
    selectedRelease ||
    getBestRelease(result.releases || [], result.title) ||
    result.releases?.[0];

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
      className={`mb-2 rounded-lg px-4 py-2 ${
        isSelected ? "bg-primary/20" : "bg-secondary/10"
      }`}
    >
      <View className={`flex-row items-center justify-between gap-4`}>
        <Image
          className="h-16 w-16 rounded-lg bg-gray-500/50"
          source={{
            uri: `https://coverartarchive.org/release/${currentRelease?.id}/front-250`,
          }}
        />
        <View className="flex-1">
          <Text className="line-clamp-2 text-sm font-bold">{result.title}</Text>
          <Text className="text-sm text-muted-foreground">
            {result["artist-credit"]?.[0]?.artist?.name ?? "Unknown Artist"}
          </Text>

          {/* Release Selector Button */}
          {result.releases && result.releases?.length > 0 && (
            <TouchableOpacity
              onPress={() => showModal()}
              className="flex w-full items-start justify-between rounded-lg bg-secondary/10 p-1 md:flex-row md:items-center md:gap-1"
            >
              <View className="flex w-full flex-1 items-start gap-1 overflow-hidden md:flex-row">
                <Text className="whitespace-nowrap text-sm text-gray-500">
                  Release:
                </Text>
                <Text className="line-clamp-1 text-sm">
                  {currentRelease?.title}
                  {currentRelease?.date ? ` (${currentRelease.date})` : ""}
                  {currentRelease?.country
                    ? ` - ${currentRelease.country}`
                    : ""}
                </Text>
              </View>
              {/* the chevron looks odd in the other layout so I'm just hiding it for now. -mm */}
              <ChevronDown className="hidden h-6 w-6 md:ml-1 md:block" />
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
          <View className="rounded-full bg-primary p-1">
            <Icon icon={Check} size={20} />
          </View>
        ) : (
          <View className="rounded-full border-2 border-secondary p-3"></View>
        )}
      </View>

      {/* Release Selection Modal */}
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing={true}
        detached={true}
        backdropComponent={SheetBackdrop}
        handleComponent={SheetHandle}
      >
        <View className="-mt-2 border-x border-b border-neutral-500/30 bg-card pb-4">
          <Text className="text-center text-lg font-bold">Select Release</Text>
          <TouchableOpacity
            className="absolute right-4 top-1.5"
            onPress={() => dismissModal()}
          >
            <Text className="text-primary">Done</Text>
          </TouchableOpacity>
        </View>
        <BottomSheetScrollView className="min-h-64 border-x border-neutral-500/30 bg-card">
          {result.releases?.map((release) => (
            <TouchableOpacity
              key={release.id}
              className={`border-b border-gray-100 p-4 ${
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
                <Text className="text-sm italic text-gray-400">
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
