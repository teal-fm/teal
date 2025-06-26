import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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
  SearchResultProps,
} from "@/lib/oldStamp";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Check, ChevronDown, ChevronRight } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { StampStep, useStampCtx } from "@/lib/state/stamp";
import { Label } from "@/components/ui/label";
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useStampSearchMutation } from "@/lib/state/queries/stamp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stepOneFormSchema = z.object({
  track: z.string(),
  artist: z.string(),
  release: z.string(),
});
type StepOneForm = z.infer<typeof stepOneFormSchema>;

export default function StepOne() {
  const router = useRouter();
  const { state, setState } = useStampCtx();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    getValues,
    reset,
  } = useForm<StepOneForm>({
    defaultValues: {
      track: '',
      artist: '',
      release: '',
    },
    resolver: zodResolver(stepOneFormSchema),
  });

  const { mutate: search, reset: resetSearch, data, isPending } = useStampSearchMutation({
    data: getValues,
    onSuccess: () => {},
  });

  const [selectedTrack, setSelectedTrack] = useState<MusicBrainzRecording | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [releaseSelections, setReleaseSelections] = useState<ReleaseSelections>(
    {},
  );

  // reset search state if requested
  useEffect(() => {
    if (state.step === StampStep.IDLE && state.resetSearchState) {
      reset();
      resetSearch();
      setSelectedTrack(null);
    }
  }, [state]);

  const handleSearch = handleSubmit(async data => {
    setSelectedTrack(null);
    search(getValues());
    setHasSearched(true);
  });

  const clearSearch = () => {
    resetSearch();
    setSelectedTrack(null);
  };

  return (
    <ScrollView className="flex-1 items-center justify-start bg-background p-4">
      {/* Search Form */}
      <View className="flex flex-col w-screen max-w-2xl gap-2">

        <View className="flex flex-col gap-1">
          <Label className="text-muted-foreground">Track name</Label>
          <Controller
            control={control}
            name="track"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                id="track"
                placeholder="Track name..."
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          {errors.track && <Text>{errors.track.message}</Text>}
        </View>

        <View className="flex flex-col gap-1">
          <Label className="text-muted-foreground">Artist</Label>
          <Controller
            control={control}
            name="artist"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Artist..."
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          {errors.artist && <Text>{errors.artist.message}</Text>}
        </View>

        <View className="flex flex-col gap-1">
          <Label className="text-muted-foreground">Album</Label>
          <Controller
            control={control}
            name="release"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                placeholder="Album..."
                onBlur={onBlur}
                onChange={onChange}
                value={value}
              />
            )}
          />
          {errors.release && <Text>{errors.release.message}</Text>}
        </View>

        <View className="mt-2 flex-row gap-2">
          <Button
            className="flex-1"
            onPress={handleSearch}
            disabled={isPending || !isDirty}
          >
            <Text>{isPending ? "Searching..." : "Search"}</Text>
          </Button>

          <Button className="flex-1" onPress={clearSearch} variant="outline">
            <Text>Clear</Text>
          </Button>
        </View>

      </View>

      {/* Search Results */}
      {data && (
        <View className="flex w-screen max-w-2xl gap-4">
          {data.length > 0 ? (
            <View className="mt-4">
              <Text className="mb-2 text-lg font-bold">
                Search Results ({data.length})
              </Text>

              <FlatList
                data={data}
                ItemSeparatorComponent={() => <View className="h-4" />}
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
      )}
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
      className="rounded-lg px-4 py-2 border border-border shadow-sm shadow-foreground/10 bg-card focus:outline-none"
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
