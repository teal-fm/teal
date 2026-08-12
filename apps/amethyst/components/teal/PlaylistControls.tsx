import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/lib/icons/iconWithClassName";
import { searchMusicbrainz, type MusicBrainzRecording } from "@/lib/oldStamp";
import {
  coverArtUrl,
  getPlayByUri,
  getSearchResults,
  type SocialPlaylistItemView,
  type SocialPlaylistView,
} from "@/lib/teal/api";
import { playViewToTrackView, type TrackViewLike } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";
import { RichText as AtprotoRichText } from "@atproto/api";
import { Music2, Search } from "lucide-react-native";

import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";
import type { SongResult } from "@teal/lexicons/src/types/fm/teal/alpha/search/defs";

type SearchSource = "history" | "musicbrainz";

type TrackSearchResult = {
  id: string;
  track: TrackViewLike;
  title: string;
  artist: string;
  release?: string;
  artwork?: string;
  detail: string;
  sourceUri?: string;
};

function musicBrainzTrack(result: MusicBrainzRecording): TrackViewLike {
  const release = result.selectedRelease || result.releases?.[0];
  const artists = result["artist-credit"]?.map((credit) => ({
    artistName: credit.name,
    artistMbId: credit.artist.id ? `mbid:${credit.artist.id}` : undefined,
  }));

  return {
    trackName: result.title,
    trackMbId: `mbid:${result.id}`,
    recordingMbId: `mbid:${result.id}`,
    duration: result.length ? Math.round(result.length / 1000) : undefined,
    artistNames: artists?.map((artist) => artist.artistName),
    artists,
    releaseName: release?.title,
    releaseMbId: release?.id ? `mbid:${release.id}` : undefined,
    isrc: result.isrcs?.[0],
  };
}

function historyTrack(song: SongResult): TrackViewLike {
  return {
    trackName: song.trackName,
    recordingMbId: song.recordingMbId,
    trackMbId: song.recordingMbId,
    artistNames: [song.artistName],
    artists: [{ artistName: song.artistName }],
    releaseName: song.releaseName,
    releaseMbId: song.releaseMbId,
  };
}

function trackKey(track: unknown) {
  const value = (track || {}) as TrackViewLike;
  if (value.recordingMbId) return value.recordingMbId;
  const artist =
    value.artists?.[0]?.artistName || value.artistNames?.[0] || "";
  return `${value.trackName || ""}\u0000${artist}`.toLocaleLowerCase();
}

function toTrackRecord(track: TrackViewLike) {
  const artists =
    track.artists?.map((artist, index) => ({
      artistName:
        artist.artistName ||
        artist.name ||
        track.artistNames?.[index] ||
        "Unknown artist",
      artistMbId:
        artist.artistMbId || artist.mbid || track.artistMbIds?.[index],
    })) ||
    track.artistNames?.map((artistName, index) => ({
      artistName,
      artistMbId: track.artistMbIds?.[index],
    })) ||
    [];

  return {
    trackName: track.trackName?.trim() || "Unknown track",
    trackMbId: track.trackMbId,
    recordingMbId: track.recordingMbId || track.trackMbId,
    duration: track.duration,
    artistNames: artists.map((artist) => artist.artistName),
    artistMbIds: artists
      .map((artist) => artist.artistMbId)
      .filter((mbid): mbid is string => Boolean(mbid)),
    artists,
    releaseName: track.releaseName,
    releaseMbId: track.releaseMbId,
    isrc: track.isrc,
    originUrl: track.originUrl,
  };
}

export function PlaylistCreator({
  onCreated,
}: {
  onCreated: (playlist: SocialPlaylistView) => void;
}) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!pdsAgent?.did || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = {
        $type: "fm.teal.alpha.feed.social.playlist",
        name: name.trim(),
        description: description.trim() || undefined,
        descriptionFacets: undefined as unknown[] | undefined,
        authors: [pdsAgent.did],
        createdAt: new Date().toISOString(),
      };
      if (record.description) {
        const rt = new AtprotoRichText({ text: record.description });
        await rt.detectFacets(pdsAgent);
        record.descriptionFacets = rt.facets;
      }
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.playlist",
          record,
        },
      );
      onCreated({
        uri: (res.data as { uri?: string }).uri || "",
        cid: (res.data as { cid?: string }).cid || "",
        authorDid: pdsAgent.did,
        name: record.name,
        description: record.description,
        descriptionFacets: record.descriptionFacets,
        authors: record.authors,
        createdAt: record.createdAt,
        itemCount: 0,
      });
      setName("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <Text className="font-mono text-[10px] uppercase text-primary">
        New playlist
      </Text>
      <Input
        className="mt-3"
        placeholder="Playlist name"
        value={name}
        onChangeText={setName}
      />
      <Textarea
        className="mt-3 min-h-20"
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
      />
      {error && <Text className="mt-2 text-sm text-destructive">{error}</Text>}
      <Button className="mt-3 self-start" disabled={busy} onPress={create}>
        <Text>{busy ? "Creating..." : "Create playlist"}</Text>
      </Button>
    </View>
  );
}

export function AddCurrentTrackButton({
  playlist,
  track,
  order,
  onAdded,
  disabled,
  onBusyChange,
}: {
  playlist: Pick<SocialPlaylistView, "uri" | "cid">;
  track?: PlayView | null;
  order: number;
  onAdded: (item: SocialPlaylistItemView) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  return (
    <AddTrackButton
      playlist={playlist}
      track={track ? playViewToTrackView(track) : null}
      order={order}
      onAdded={onAdded}
      label="Add current track"
      disabled={disabled}
      onBusyChange={onBusyChange}
    />
  );
}

export function AddTrackButton({
  playlist,
  track,
  order,
  onAdded,
  label = "Add track",
  isAdded = false,
  disabled = false,
  onBusyChange,
  resolveTrack,
}: {
  playlist: Pick<SocialPlaylistView, "uri" | "cid">;
  track?: TrackViewLike | null;
  order: number;
  onAdded: (item: SocialPlaylistItemView) => void;
  label?: string;
  isAdded?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  resolveTrack?: () => Promise<TrackViewLike>;
}) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!pdsAgent?.did || !track || busy || disabled) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const trackToAdd = resolveTrack ? await resolveTrack() : track;
      const record = {
        $type: "fm.teal.alpha.feed.social.playlistItem",
        subject: { uri: playlist.uri, cid: playlist.cid },
        track: toTrackRecord(trackToAdd),
        order,
        createdAt: new Date().toISOString(),
      };
      const res = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.feed.social.playlistItem",
          record,
        },
      );
      onAdded({
        uri: (res.data as { uri?: string }).uri || "",
        cid: (res.data as { cid?: string }).cid || "",
        authorDid: pdsAgent.did,
        track: record.track,
        order,
        createdAt: record.createdAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <View className="items-end gap-1">
      <Button
        disabled={disabled || !track || busy || isAdded}
        onPress={add}
        variant={isAdded ? "secondary" : "default"}
      >
        <Text>{isAdded ? "Added" : busy ? "Adding..." : label}</Text>
      </Button>
      {error && (
        <Text className="max-w-48 text-right text-xs text-destructive">
          {error}
        </Text>
      )}
    </View>
  );
}

function resultFromMusicBrainz(
  result: MusicBrainzRecording,
): TrackSearchResult {
  const track = musicBrainzTrack(result);
  const artist =
    track.artists?.map((item) => item.artistName).join(", ") ||
    "Unknown artist";
  const releaseId = track.releaseMbId?.replace(/^mbid:/, "");
  return {
    id: `musicbrainz:${result.id}`,
    track,
    title: track.trackName || "Unknown track",
    artist,
    release: track.releaseName,
    artwork: releaseId ? coverArtUrl(releaseId, 160) : undefined,
    detail: "MusicBrainz catalog",
  };
}

function resultFromHistory(song: SongResult): TrackSearchResult {
  const track = historyTrack(song);
  return {
    id: `history:${song.recordingMbId || song.uri}`,
    track,
    title: song.trackName,
    artist: song.artistName,
    release: song.releaseName,
    artwork: song.releaseMbId ? coverArtUrl(song.releaseMbId, 160) : undefined,
    detail: `${song.playCount} listen${song.playCount === 1 ? "" : "s"}`,
    sourceUri: song.uri,
  };
}

export function PlaylistTrackPicker({
  playlist,
  items,
  order,
  onAdded,
  disabled = false,
  onBusyChange,
}: {
  playlist: Pick<SocialPlaylistView, "uri" | "cid">;
  items: SocialPlaylistItemView[];
  order: number;
  onAdded: (item: SocialPlaylistItemView) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [source, setSource] = useState<SearchSource>("history");
  const [query, setQuery] = useState("");
  const [historyResults, setHistoryResults] = useState<TrackSearchResult[]>([]);
  const [musicBrainzResults, setMusicBrainzResults] = useState<
    TrackSearchResult[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addedKeys = useMemo(
    () => new Set(items.map((item) => trackKey(item.track))),
    [items],
  );
  const results = source === "history" ? historyResults : musicBrainzResults;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    if (source === "history" && !pdsAgent?.did) {
      return;
    }

    let mounted = true;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      const request =
        source === "history"
          ? getSearchResults(trimmed, 12, pdsAgent?.did).then((response) =>
              response.songs.map(resultFromHistory),
            )
          : searchMusicbrainz({ track: trimmed }, { throwOnError: true }).then((response) =>
              response.map(resultFromMusicBrainz),
            );

      request
        .then((nextResults) => {
          if (!mounted) return;
          if (source === "history") setHistoryResults(nextResults);
          else setMusicBrainzResults(nextResults);
        })
        .catch((searchError) => {
          if (!mounted) return;
          setError(
            searchError instanceof Error
              ? searchError.message
              : String(searchError),
          );
          if (source === "history") setHistoryResults([]);
          else setMusicBrainzResults([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [pdsAgent?.did, query, source]);

  return (
    <View className="mt-5 overflow-hidden rounded-lg border border-primary/25 bg-primary/5">
      <View className="border-b border-primary/15 px-4 pb-4 pt-5">
        <Text className="font-mono text-[10px] uppercase tracking-[2px] text-primary">
          Add to playlist
        </Text>
        <Text className="mt-1 font-sans text-xl font-black">Find a track</Text>
        <Text className="mt-1 text-sm leading-5 text-muted-foreground">
          Pull from your listening history or browse the MusicBrainz catalog.
        </Text>
        <View className="mt-4 flex-row gap-2">
          <Button
            size="sm"
            variant={source === "history" ? "default" : "outline"}
            disabled={!pdsAgent?.did}
            onPress={() => setSource("history")}
          >
            <Text>Your history</Text>
          </Button>
          <Button
            size="sm"
            variant={source === "musicbrainz" ? "default" : "outline"}
            onPress={() => setSource("musicbrainz")}
          >
            <Text>MusicBrainz</Text>
          </Button>
        </View>
        <View className="mt-3 flex-row items-center gap-2 rounded-md border border-border bg-background px-3">
          <Icon icon={Search} size={18} className="text-muted-foreground" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={
              source === "history"
                ? "Search your listens"
                : "Search the catalog"
            }
            className="h-11 flex-1 border-0 bg-transparent px-0 web:focus-visible:ring-0"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View className="px-2 py-2">
        {source === "history" && !pdsAgent?.did ? (
          <View className="items-center px-6 py-8">
            <Text className="text-center font-black">
              Sign in to search your history
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground">
              MusicBrainz lookup is available without an account.
            </Text>
          </View>
        ) : query.trim().length < 2 ? (
          <View className="items-center px-6 py-8">
            <Icon icon={Music2} size={24} className="text-primary" />
            <Text className="mt-2 text-center text-sm text-muted-foreground">
              Type at least two characters to search.
            </Text>
          </View>
        ) : loading ? (
          <View className="items-center py-8">
            <ActivityIndicator />
            <Text className="mt-2 text-sm text-muted-foreground">
              Searching...
            </Text>
          </View>
        ) : error ? (
          <Text className="px-3 py-6 text-center text-sm text-destructive">
            {error}
          </Text>
        ) : results.length === 0 ? (
          <Text className="px-3 py-6 text-center text-sm text-muted-foreground">
            No tracks found in{" "}
            {source === "history" ? "your history" : "MusicBrainz"}.
          </Text>
        ) : (
          results.map((result) => (
            <View
              key={result.id}
              className="flex-row items-center gap-3 rounded-md px-2 py-3 web:hover:bg-background"
            >
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-muted">
                {result.artwork ? (
                  <Image
                    source={{ uri: result.artwork }}
                    className="h-full w-full"
                  />
                ) : (
                  <Icon
                    icon={Music2}
                    size={19}
                    className="text-muted-foreground"
                  />
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-black" numberOfLines={1}>
                  {result.title}
                </Text>
                <Text
                  className="text-sm text-muted-foreground"
                  numberOfLines={1}
                >
                  {result.artist}
                </Text>
                <Text
                  className="font-mono text-[10px] uppercase text-muted-foreground"
                  numberOfLines={1}
                >
                  {result.release || result.detail}
                </Text>
              </View>
              <AddTrackButton
                playlist={playlist}
                track={result.track}
                order={order}
                onAdded={onAdded}
                isAdded={addedKeys.has(trackKey(result.track))}
                disabled={disabled}
                onBusyChange={onBusyChange}
                resolveTrack={
                  result.sourceUri
                    ? async () =>
                        playViewToTrackView(
                          (await getPlayByUri(result.sourceUri as string)).play,
                        )
                    : undefined
                }
              />
            </View>
          ))
        )}
      </View>
    </View>
  );
}
