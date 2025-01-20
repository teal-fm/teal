import { View, ScrollView, TouchableOpacity, Image, Modal } from "react-native";
import { useState } from "react";
import { Text } from "../components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Check } from "lucide-react-native";
import { Record as PlayRecord } from "@teal/lexicons/src/types/fm/teal/alpha/feed/play";
import React from "react";

// MusicBrainz API Types
export interface MusicBrainzArtistCredit {
  artist: {
    id: string;
    name: string;
    "sort-name"?: string;
  };
  joinphrase?: string;
  name: string;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  status?: string;
  date?: string;
  country?: string;
  disambiguation?: string;
  "track-count"?: number;
}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  isrcs?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
  selectedRelease?: MusicBrainzRelease; // Added for UI state
}

export interface SearchParams {
  track?: string;
  artist?: string;
  release?: string;
}

export interface SearchResultProps {
  result: MusicBrainzRecording;
  onSelectTrack: (track: MusicBrainzRecording | null) => void;
  isSelected: boolean;
  selectedRelease: MusicBrainzRelease | null;
  onReleaseSelect: (trackId: string, release: MusicBrainzRelease) => void;
}

export interface ReleaseSelections {
  [key: string]: MusicBrainzRelease;
}

export interface PlaySubmittedData {
  playRecord: PlayRecord | null;
  playAtUrl: string | null;
  blueskyPostUrl: string | null;
}

export async function searchMusicbrainz(
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
