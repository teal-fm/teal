import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import { RichText as AtprotoRichText } from "@atproto/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/icons/iconWithClassName";
import {
  coverArtUrl,
  displayArtists,
  getActorFeed,
  type SocialPostView,
} from "@/lib/teal/api";
import { playViewToTrackView } from "@/lib/teal/social";
import {
  type MusicBrainzRecording,
  type MusicBrainzRelease,
  searchMusicbrainz,
} from "@/lib/oldStamp";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/stores/mainStore";
import { Check, Disc3, Music2, Search, X } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type CreateSocialPostModalProps = {
  visible: boolean;
  onClose: () => void;
  onPublished: (post: SocialPostView) => void;
};

type SearchMode = "musicbrainz" | "recent";

type MusicBrainzFields = {
  track: string;
  artist: string;
  release: string;
};

function extractTags(text: string) {
  return Array.from(text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,64})/gu))
    .map((match) => match[2])
    .slice(0, 8);
}

function currentLangs() {
  if (typeof navigator === "undefined") return undefined;
  const language = navigator.language?.split("-")[0];
  return language ? [language].slice(0, 3) : undefined;
}

function bestRelease(recording: MusicBrainzRecording) {
  const releases = [...(recording.releases || [])];
  if (releases.length === 0) return undefined;
  releases.sort(
    (a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999") ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
  return (
    releases.find(
      (release) =>
        (release.country === "XW" || release.country === "US") &&
        release.title !== recording.title,
    ) ||
    releases.find((release) => release.title !== recording.title) ||
    releases[0]
  );
}

function musicBrainzToPlayView(
  recording: MusicBrainzRecording,
  release?: MusicBrainzRelease,
): PlayView {
  const selectedRelease = release || recording.selectedRelease || bestRelease(recording);
  return {
    trackName: recording.title || "Unknown track",
    trackMbId: recording.id ? `mbid:${recording.id}` : undefined,
    recordingMbId: recording.id ? `mbid:${recording.id}` : undefined,
    duration: recording.length ? Math.floor(recording.length / 1000) : undefined,
    artists:
      recording["artist-credit"]?.map((credit) => ({
        artistName: credit.name || credit.artist.name,
        artistMbId: credit.artist.id ? `mbid:${credit.artist.id}` : undefined,
      })) || [],
    releaseName: selectedRelease?.title,
    releaseMbId: selectedRelease?.id ? `mbid:${selectedRelease.id}` : undefined,
    isrc: recording.isrcs?.[0],
    originUrl: recording.id
      ? `https://musicbrainz.org/recording/${recording.id}`
      : undefined,
  };
}

function artForPlay(play: PlayView) {
  return coverArtUrl(play.releaseMbId);
}

function TrackOption({
  play,
  selected,
  detail,
  onPress,
}: {
  play: PlayView;
  selected: boolean;
  detail?: string;
  onPress: () => void;
}) {
  const art = artForPlay(play);
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-lg border p-3 web:transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card web:hover:border-primary/45"
      }`}
    >
      <View className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {art ? (
          <Image source={{ uri: art }} className="h-full w-full" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon icon={Disc3} size={24} className="text-muted-foreground" />
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-black" numberOfLines={2}>
          {play.trackName}
        </Text>
        <Text className="text-sm font-bold text-muted-foreground" numberOfLines={1}>
          {displayArtists(play) || "Unknown artist"}
        </Text>
        {(play.releaseName || detail) && (
          <Text className="mt-1 font-mono text-[10px] uppercase text-muted-foreground" numberOfLines={1}>
            {detail || play.releaseName}
          </Text>
        )}
      </View>
      <View
        className={`h-8 w-8 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary" : "border-border"
        }`}
      >
        {selected && <Icon icon={Check} size={16} className="text-primary-foreground" />}
      </View>
    </Pressable>
  );
}

export default function CreateSocialPostModal({
  visible,
  onClose,
  onPublished,
}: CreateSocialPostModalProps) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const [mode, setMode] = useState<SearchMode>("musicbrainz");
  const [fields, setFields] = useState<MusicBrainzFields>({
    track: "",
    artist: "",
    release: "",
  });
  const [musicBrainzResults, setMusicBrainzResults] = useState<PlayView[]>([]);
  const [recentPlays, setRecentPlays] = useState<PlayView[]>([]);
  const [recentQuery, setRecentQuery] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<PlayView | null>(null);
  const [postText, setPostText] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = useMemo(() => extractTags(postText), [postText]);

  useEffect(() => {
    if (!visible || mode !== "recent" || !pdsAgent?.did || recentPlays.length > 0) {
      return;
    }
    let mounted = true;
    setLoadingRecent(true);
    getActorFeed(pdsAgent.did, 30)
      .then((res) => {
        if (mounted) setRecentPlays(res.plays);
      })
      .catch((e) => {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (mounted) setLoadingRecent(false);
      });
    return () => {
      mounted = false;
    };
  }, [mode, pdsAgent?.did, recentPlays.length, visible]);

  const filteredRecent = useMemo(() => {
    const query = recentQuery.trim().toLowerCase();
    if (!query) return recentPlays;
    return recentPlays.filter((play) =>
      `${play.trackName} ${displayArtists(play)} ${play.releaseName || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [recentPlays, recentQuery]);

  async function searchMusicBrainz() {
    if (!fields.track.trim() && !fields.artist.trim() && !fields.release.trim()) return;
    setSearching(true);
    setError(null);
    setSelectedTrack(null);
    try {
      const results = await searchMusicbrainz({
        track: fields.track.trim(),
        artist: fields.artist.trim(),
        release: fields.release.trim(),
      });
      setMusicBrainzResults(results.slice(0, 12).map((result) => musicBrainzToPlayView(result)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!pdsAgent?.did || !selectedTrack || submitting) return;
    const text = postText.trim();
    if (!text) {
      setError("Write something before posting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const rt = new AtprotoRichText({ text });
      await rt.detectFacets(pdsAgent);
      const record = {
        $type: "fm.teal.alpha.feed.social.post",
        text,
        track: playViewToTrackView(selectedTrack),
        facets: rt.facets,
        tags,
        langs: currentLangs(),
        createdAt: new Date().toISOString(),
      };
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.post",
          record,
        },
      );
      onPublished({
        uri: (res.data as { uri?: string }).uri || "",
        cid: (res.data as { cid?: string }).cid || "",
        authorDid: pdsAgent.did,
        text,
        track: record.track,
        facets: rt.facets,
        tags,
        langs: record.langs,
        createdAt: record.createdAt,
        likeCount: 0,
        repostCount: 0,
        replyCount: 0,
      });
      setPostText("");
      setSelectedTrack(null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-foreground/70 p-3 md:items-center md:justify-center md:p-6">
        <View className="max-h-[94vh] w-full overflow-hidden rounded-lg border border-border bg-background md:max-w-[46rem]">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <View className="min-w-0 flex-1">
              <Text className="font-mono text-[10px] uppercase text-primary">
                Create post
              </Text>
              <Text className="text-xl font-black">Find a song, say the thing</Text>
            </View>
            <Button variant="ghost" size="icon" onPress={onClose}>
              <Icon icon={X} size={20} />
            </Button>
          </View>

          <ScrollView className="max-h-[82vh]" contentContainerClassName="gap-4 p-4">
            {status !== "loggedIn" ? (
              <View className="rounded-lg border border-border bg-card p-4">
                <Text className="font-bold">Sign in to create Teal posts.</Text>
                <Text className="mt-1 text-sm text-muted-foreground">
                  Posts are written to your ATProto repo and indexed by Teal.
                </Text>
              </View>
            ) : (
              <>
                <View className="flex-row rounded-lg border border-border bg-card p-1">
                  <Pressable
                    onPress={() => setMode("musicbrainz")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-md px-3 py-2 ${
                      mode === "musicbrainz" ? "bg-accent" : ""
                    }`}
                  >
                    <Icon icon={Search} size={16} className={mode === "musicbrainz" ? "text-primary" : "text-muted-foreground"} />
                    <Text className="text-sm font-black">MusicBrainz</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMode("recent")}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-md px-3 py-2 ${
                      mode === "recent" ? "bg-accent" : ""
                    }`}
                  >
                    <Icon icon={Music2} size={16} className={mode === "recent" ? "text-primary" : "text-muted-foreground"} />
                    <Text className="text-sm font-black">My recent plays</Text>
                  </Pressable>
                </View>

                {mode === "musicbrainz" ? (
                  <View className="gap-3">
                    <View className="gap-2 md:flex-row">
                      <Input
                        className="md:flex-1"
                        placeholder="Track"
                        value={fields.track}
                        onChangeText={(track) => setFields((current) => ({ ...current, track }))}
                        onSubmitEditing={searchMusicBrainz}
                      />
                      <Input
                        className="md:flex-1"
                        placeholder="Artist"
                        value={fields.artist}
                        onChangeText={(artist) => setFields((current) => ({ ...current, artist }))}
                        onSubmitEditing={searchMusicBrainz}
                      />
                    </View>
                    <View className="gap-2 md:flex-row">
                      <Input
                        className="md:flex-1"
                        placeholder="Album (optional)"
                        value={fields.release}
                        onChangeText={(release) => setFields((current) => ({ ...current, release }))}
                        onSubmitEditing={searchMusicBrainz}
                      />
                      <Button
                        className="md:w-36"
                        disabled={searching || (!fields.track.trim() && !fields.artist.trim() && !fields.release.trim())}
                        onPress={searchMusicBrainz}
                      >
                        <Text>{searching ? "Searching..." : "Search"}</Text>
                      </Button>
                    </View>
                    <View className="gap-2">
                      {musicBrainzResults.map((play) => (
                        <TrackOption
                          key={`${play.recordingMbId}-${play.releaseMbId}`}
                          play={play}
                          selected={selectedTrack?.recordingMbId === play.recordingMbId}
                          onPress={() => setSelectedTrack(play)}
                        />
                      ))}
                      {!searching && musicBrainzResults.length === 0 && (
                        <Text className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Search MusicBrainz by track, artist, or album to attach a song.
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View className="gap-3">
                    <Input
                      placeholder="Filter recent plays"
                      value={recentQuery}
                      onChangeText={setRecentQuery}
                    />
                    <View className="gap-2">
                      {loadingRecent && (
                        <Text className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                          Loading your recent plays...
                        </Text>
                      )}
                      {filteredRecent.map((play) => (
                        <TrackOption
                          key={play.uri || `${play.trackName}-${play.playedTime}`}
                          play={play}
                          detail={
                            play.playedTime
                              ? `listened ${timeAgo(new Date(play.playedTime))}`
                              : undefined
                          }
                          selected={selectedTrack?.uri === play.uri}
                          onPress={() => setSelectedTrack(play)}
                        />
                      ))}
                      {!loadingRecent && filteredRecent.length === 0 && (
                        <Text className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No indexed recent plays matched.
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                <View className="gap-2">
                  <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                    Post text
                  </Text>
                  {selectedTrack && (
                    <Text className="text-sm font-bold" numberOfLines={1}>
                      Attached: {selectedTrack.trackName} · {displayArtists(selectedTrack)}
                    </Text>
                  )}
                  <Textarea
                    className="min-h-28"
                    placeholder="What do you want to say about this song?"
                    value={postText}
                    onChangeText={setPostText}
                  />
                  {tags.length > 0 && (
                    <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                      Tags: {tags.join(", ")}
                    </Text>
                  )}
                </View>

                {error && <Text className="text-sm text-destructive">{error}</Text>}

                <View className="flex-row justify-end gap-2 border-t border-border pt-4">
                  <Button variant="outline" onPress={onClose}>
                    <Text>Cancel</Text>
                  </Button>
                  <Button
                    disabled={submitting || !selectedTrack || !postText.trim() || postText.length > 3000}
                    onPress={submit}
                  >
                    <Text>{submitting ? "Posting..." : "Post"}</Text>
                  </Button>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
