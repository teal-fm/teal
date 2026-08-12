import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
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
  getRecordingCoverArtUrl,
  type SocialPostView,
} from "@/lib/teal/api";
import { playViewToTrackView } from "@/lib/teal/social";
import {
  type MusicBrainzRecording,
  type MusicBrainzRelease,
  searchMusicbrainz,
} from "@/lib/oldStamp";
import { useStore } from "@/stores/mainStore";
import { Check, Disc3, Search } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

type SocialComposerProps = {
  track?: PlayView | null;
  allowTrackChange?: boolean;
  replyTo?: Pick<
    SocialPostView,
    | "uri"
    | "cid"
    | "replyRootUri"
    | "replyParentUri"
    | "replyRootCid"
    | "replyParentCid"
  >;
  compact?: boolean;
  onPublished: (post: SocialPostView) => void;
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
  const selectedRelease =
    release || recording.selectedRelease || bestRelease(recording);
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
    releaseMbId: selectedRelease?.id
      ? `mbid:${selectedRelease.id}`
      : undefined,
    isrc: recording.isrcs?.[0],
    originUrl: recording.id
      ? `https://musicbrainz.org/recording/${recording.id}`
      : undefined,
  };
}

function TrackArtwork({ play, size = 44 }: { play: PlayView; size?: number }) {
  const [recordingArt, setRecordingArt] = useState<string>();
  const [artFailed, setArtFailed] = useState(false);
  const releaseArt = coverArtUrl(play.releaseMbId, 100);
  const art = artFailed ? undefined : releaseArt || recordingArt;

  useEffect(() => {
    let mounted = true;
    setArtFailed(false);
    if (releaseArt || !play.recordingMbId) {
      setRecordingArt(undefined);
      return;
    }
    getRecordingCoverArtUrl(play.recordingMbId, 100).then((url) => {
      if (mounted) setRecordingArt(url);
    });
    return () => {
      mounted = false;
    };
  }, [play.recordingMbId, releaseArt]);

  return (
    <View
      className="shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      style={{ height: size, width: size }}
    >
      {art ? (
        <Image
          source={{ uri: art }}
          className="h-full w-full"
          onError={() => setArtFailed(true)}
        />
      ) : (
        <Icon
          icon={Disc3}
          size={Math.max(18, size / 2)}
          className="text-muted-foreground"
        />
      )}
    </View>
  );
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
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 rounded-lg border p-3 web:transition-colors ${
        selected
          ? "border-primary bg-primary/10"
          : "border-border bg-card web:hover:border-primary/45"
      }`}
    >
      <TrackArtwork play={play} />
      <View className="min-w-0 flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {play.trackName}
        </Text>
        <Text
          className="text-sm font-bold text-muted-foreground"
          numberOfLines={1}
        >
          {displayArtists(play) || "Unknown artist"}
        </Text>
        {(play.releaseName || detail) && (
          <Text
            className="mt-1 font-mono text-[10px] uppercase text-muted-foreground"
            numberOfLines={1}
          >
            {detail || play.releaseName}
          </Text>
        )}
      </View>
      <View
        className={`h-7 w-7 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary" : "border-border"
        }`}
      >
        {selected && (
          <Icon icon={Check} size={14} className="text-primary-foreground" />
        )}
      </View>
    </Pressable>
  );
}

export default function SocialComposer({
  track,
  allowTrackChange,
  replyTo,
  compact,
  onPublished,
}: SocialComposerProps) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const tealProfile = useStore((state) => {
    const did = state.pdsAgent?.did;
    return did ? state.profiles[did]?.teal : undefined;
  });
  const [selectedTrack, setSelectedTrack] = useState<PlayView | null>(
    track || null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentPlays, setRecentPlays] = useState<PlayView[]>([]);
  const [recentQuery, setRecentQuery] = useState("");
  const [musicQuery, setMusicQuery] = useState("");
  const [musicBrainzResults, setMusicBrainzResults] = useState<PlayView[]>([]);
  const [text, setText] = useState("");
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = useMemo(() => extractTags(text), [text]);
  const canChangeTrack = allowTrackChange && !replyTo;

  useEffect(() => {
    if (!canChangeTrack) {
      setSelectedTrack(track || null);
      return;
    }
    if (track) setSelectedTrack(track);
  }, [canChangeTrack, track]);

  useEffect(() => {
    if (!canChangeTrack || status !== "loggedIn" || !pdsAgent?.did) {
      setRecentPlays([]);
      return;
    }
    let mounted = true;
    setLoadingRecent(true);
    getActorFeed(pdsAgent.did, 20)
      .then((res) => {
        if (!mounted) return;
        setRecentPlays(res.plays);
        setSelectedTrack((current) => current || res.plays[0] || null);
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
  }, [canChangeTrack, pdsAgent?.did, status]);

  const filteredRecent = useMemo(() => {
    const query = recentQuery.trim().toLowerCase();
    if (!query) return recentPlays;
    return recentPlays.filter((play) =>
      `${play.trackName} ${displayArtists(play)} ${play.releaseName || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [recentPlays, recentQuery]);

  async function searchSongs() {
    const query = musicQuery.trim();
    if (!query) return;
    setSearching(true);
    setError(null);
    try {
      const results = await searchMusicbrainz({
        track: query,
        artist: "",
        release: "",
      });
      setMusicBrainzResults(
        results.slice(0, 8).map((result) => musicBrainzToPlayView(result)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (!pdsAgent?.did || !selectedTrack || submitting) return;
    const postText = text.trim();
    if (!postText) return;
    setSubmitting(true);
    setError(null);
    try {
      const rt = new AtprotoRichText({ text: postText });
      await rt.detectFacets(pdsAgent);
      const record = {
        $type: "fm.teal.alpha.feed.social.post",
        text: postText,
        track: playViewToTrackView(selectedTrack),
        reply: replyTo
          ? {
              root: {
                uri: replyTo.replyRootUri || replyTo.uri,
                cid: replyTo.replyRootCid || replyTo.cid,
              },
              parent: { uri: replyTo.uri, cid: replyTo.cid },
            }
          : undefined,
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
      const uri = (res.data as { uri?: string }).uri || "";
      const cid = (res.data as { cid?: string }).cid || "";
      const tealAuthor = tealProfile
        ? {
            did: tealProfile.did || pdsAgent.did,
            displayName: tealProfile.displayName,
            handle: (tealProfile as { handle?: string }).handle,
            avatar: tealProfile.avatar,
          }
        : undefined;
      onPublished({
        uri,
        cid,
        authorDid: pdsAgent.did,
        author: tealAuthor,
        text: postText,
        track: record.track,
        replyRootUri: record.reply?.root.uri,
        replyRootCid: record.reply?.root.cid,
        replyParentUri: record.reply?.parent.uri,
        replyParentCid: record.reply?.parent.cid,
        facets: rt.facets,
        tags,
        langs: record.langs,
        createdAt: record.createdAt,
        likeCount: 0,
        repostCount: 0,
        replyCount: 0,
      });
      setText("");
      if (canChangeTrack) setPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "loggedIn") {
    return (
      <View className="rounded-lg border border-border bg-card/80 p-4">
        <Text className="font-semibold">
          Sign in to {replyTo ? "reply" : "post"} about what you hear.
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Teal social posts attach a track and travel with your ATProto repo.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-lg border border-border bg-card/80 p-4">
      <Text className="text-xs font-light text-primary">
        {replyTo ? "Reply to post" : "Create post"}
      </Text>
      {selectedTrack ? (
        <Pressable
          disabled={!canChangeTrack}
          onPress={() => setPickerOpen((open) => !open)}
          className={`mt-2 flex-row items-center gap-3 rounded-lg border border-border bg-accent/45 p-2 ${
            canChangeTrack ? "web:hover:border-primary/50" : ""
          }`}
        >
          <TrackArtwork play={selectedTrack} size={38} />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold" numberOfLines={1}>
              {selectedTrack.trackName}
            </Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {displayArtists(selectedTrack) || "Unknown artist"}
            </Text>
          </View>
          {canChangeTrack && (
            <Text className="text-xs font-light text-primary">
              Change
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          disabled={!canChangeTrack}
          onPress={() => setPickerOpen(true)}
          className="mt-2 rounded-lg border border-dashed border-border bg-accent/45 p-3"
        >
          <Text className="font-semibold">
            {loadingRecent ? "Finding your latest listen..." : "Choose a song"}
          </Text>
          <Text className="text-sm text-muted-foreground">
            Your newest indexed listen will attach automatically when available.
          </Text>
        </Pressable>
      )}
      {pickerOpen && canChangeTrack && (
        <View className="mt-3 gap-3 rounded-lg border border-border bg-accent/45 p-3">
          <View className="gap-2 md:flex-row">
            <Input
              className="md:flex-1"
              placeholder="Search MusicBrainz"
              value={musicQuery}
              onChangeText={setMusicQuery}
              onSubmitEditing={searchSongs}
            />
            <Button
              className="md:w-28"
              disabled={searching || !musicQuery.trim()}
              onPress={searchSongs}
            >
              <Icon
                icon={Search}
                size={15}
                className="text-primary-foreground"
              />
              <Text>{searching ? "Searching" : "Search"}</Text>
            </Button>
          </View>
          {musicBrainzResults.length > 0 && (
            <View className="gap-2">
              <Text className="font-mono text-[10px] uppercase text-muted-foreground">
                MusicBrainz
              </Text>
              {musicBrainzResults.map((play) => (
                <TrackOption
                  key={`${play.recordingMbId}-${play.releaseMbId}`}
                  play={play}
                  selected={
                    selectedTrack?.recordingMbId === play.recordingMbId &&
                    selectedTrack?.releaseMbId === play.releaseMbId
                  }
                  onPress={() => {
                    setSelectedTrack(play);
                    setPickerOpen(false);
                  }}
                />
              ))}
            </View>
          )}
          <View className="gap-2">
            <Text className="font-mono text-[10px] uppercase text-muted-foreground">
              My recent plays
            </Text>
            <Input
              placeholder="Filter recent plays"
              value={recentQuery}
              onChangeText={setRecentQuery}
            />
            {loadingRecent && (
              <Text className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                Loading your recent plays...
              </Text>
            )}
            {filteredRecent.slice(0, 8).map((play) => (
              <TrackOption
                key={play.uri || `${play.trackName}-${play.playedTime}`}
                play={play}
                selected={selectedTrack?.uri === play.uri}
                detail={play.playedTime ? "recent listen" : undefined}
                onPress={() => {
                  setSelectedTrack(play);
                  setPickerOpen(false);
                }}
              />
            ))}
            {!loadingRecent && filteredRecent.length === 0 && (
              <Text className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                No indexed recent plays found.
              </Text>
            )}
          </View>
        </View>
      )}
      <Textarea
        className={compact ? "mt-3 min-h-20" : "mt-3 min-h-24"}
        placeholder={
          replyTo ? "Write a reply..." : "Say something about this track..."
        }
        value={text}
        onChangeText={setText}
      />
      {tags.length > 0 && (
        <Text className="mt-2 font-mono text-[10px] uppercase text-muted-foreground">
          Tags: {tags.join(", ")}
        </Text>
      )}
      {error && <Text className="mt-2 text-sm text-destructive">{error}</Text>}
      <Button
        className="mt-3 self-start"
        disabled={
          submitting || !selectedTrack || !text.trim() || text.length > 3000
        }
        onPress={submit}
      >
        <Text>
          {submitting ? "Publishing..." : replyTo ? "Publish reply" : "Post"}
        </Text>
      </Button>
    </View>
  );
}
