import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ListMusic, Plus } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { displayArtists, getPlaylist, getProfile, type SocialPlaylistView } from "@/lib/teal/api";
import { MAX_PLAYLIST_COLLABORATORS, resolvePlaylistAuthors } from "@/lib/teal/playlistEditing";
import { addPlaylistItem, savePlaylistRecord } from "@/lib/teal/playlists";
import { useViewerDid } from "@/lib/teal/queries";
import { musicAlbumHref, playlistHrefFromUri } from "@/lib/teal/routes";
import { playViewToTrackView, trackViewToPlayView } from "@/lib/teal/social";
import {
  AmbientSource,
  Button,
  ButtonRow,
  Cover,
  coverUri,
  ErrorNotice,
  Field,
  Glass,
  Heading,
  Loading,
  Notice,
  Row,
  Screen,
  Section,
  Text,
} from "@/components/ds";
import { TrackPicker } from "@/components/compose/TrackPicker";
import RichText from "@/components/post/RichText";
import { useStore } from "@/stores/mainStore";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function playlistCover(playlist: SocialPlaylistView) {
  return playlist.coverCid ? getImageCdnLink({ did: playlist.authorDid, hash: playlist.coverCid }) : undefined;
}

function EditPlaylist({ playlist, onDone }: { playlist: SocialPlaylistView; onDone: () => void }) {
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || "");
  const [collaborators, setCollaborators] = useState(playlist.authors.filter((did) => did !== playlist.authorDid).join("\n"));
  const [cover, setCover] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.92 });
    if (!result.canceled) setCover(result.assets[0].uri);
  };

  const save = async () => {
    if (!agent || busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await savePlaylistRecord(agent, playlist, { name, description, collaboratorsText: collaborators, newCoverUri: cover }, (input, owner) =>
        resolvePlaylistAuthors(input, owner, async (handle) => (await agent.resolveHandle({ handle })).data.did),
      );
      await client.invalidateQueries({ queryKey: ["playlist", playlist.uri] });
      onDone();
    } catch (e) {
      // resolvePlaylistAuthors explains which collaborator it couldn't find; anything else is a save failure.
      setError(e instanceof Error && /collaborator|@/i.test(e.message) ? e.message : "Your changes didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Glass strong className="gap-3 p-4">
      <Pressable accessibilityRole="button" accessibilityLabel="Change cover" onPress={pick} className="self-start">
        <Cover uri={cover ?? playlistCover(playlist)} size={120} radius={14} />
        <Text className="mt-1 text-[13px] font-semibold text-tint">Change cover</Text>
      </Pressable>
      <Field label="Name" value={name} onChangeText={setName} maxLength={50} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline maxLength={5000} />
      <Field
        label="Collaborators"
        hint={`Collaborators can add songs. Up to ${MAX_PLAYLIST_COLLABORATORS} handles, one per line.`}
        value={collaborators}
        onChangeText={setCollaborators}
        multiline
        placeholder="listener.bsky.social"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error ? (
        <Text role="alert" className="text-[14px] text-destructive">
          {error}
        </Text>
      ) : null}
      <ButtonRow>
        <Button label={busy ? "Saving" : "Save"} loading={busy} disabled={!name.trim()} onPress={save} />
        <Button label="Cancel" variant="secondary" onPress={onDone} />
      </ButtonRow>
    </Glass>
  );
}

/** Add songs: what you're playing now, or anything from your history or MusicBrainz. */
function AddSongs({ playlist }: { playlist: SocialPlaylistView }) {
  const viewer = useViewerDid();
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlayView | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const nowPlaying = useQuery({
    queryKey: ["now-playing", viewer],
    queryFn: () => getProfile(viewer!).then((r) => (r.profile.status?.item as PlayView | undefined) ?? null),
    enabled: !!viewer,
  });

  const add = async (play: PlayView) => {
    if (!agent || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await addPlaylistItem(agent, playlist, playViewToTrackView(play), playlist.itemCount);
      setStatus(`Added ${play.trackName}.`);
      setSelected(null);
      await client.invalidateQueries({ queryKey: ["playlist", playlist.uri] });
    } catch {
      setStatus("That song wasn't added. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      <ButtonRow>
        {nowPlaying.data ? (
          <Button label={`Add ${nowPlaying.data.trackName}`} icon={Plus} size="sm" loading={busy} onPress={() => add(nowPlaying.data!)} />
        ) : null}
        <Button label={open ? "Close" : "Find a song"} icon={ListMusic} size="sm" variant="secondary" aria-expanded={open} onPress={() => setOpen((o) => !o)} />
      </ButtonRow>
      {status ? (
        <Text role="status" className="text-[14px] text-ink-2">
          {status}
        </Text>
      ) : null}
      {open ? (
        <Glass strong className="gap-3 p-4">
          <TrackPicker selected={selected} onSelect={setSelected} />
          <Button label="Add to playlist" disabled={!selected} loading={busy} onPress={() => selected && add(selected)} />
        </Glass>
      ) : null}
    </View>
  );
}

/** A playlist: its cover and description, who curates it, and its songs. */
export default function PlaylistScreen() {
  const uri = param(useLocalSearchParams().uri);
  const viewer = useViewerDid();
  const valid = !!playlistHrefFromUri(uri);
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: ["playlist", uri],
    queryFn: () => getPlaylist(uri!),
    enabled: valid,
  });

  if (!valid) {
    return (
      <Screen back pageTitle="Playlist">
        <Notice title="This playlist link is incomplete" body="Ask for the full link, or open the playlist from its owner's profile." />
      </Screen>
    );
  }
  if (query.isLoading) {
    return (
      <Screen back pageTitle="Playlist">
        <Loading />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen back pageTitle="Playlist">
        <ErrorNotice title="This playlist didn't load" onRetry={() => query.refetch()} />
      </Screen>
    );
  }

  const { playlist, items } = query.data;
  const isOwner = viewer === playlist.authorDid;
  const canAdd = !!viewer && playlist.authors.includes(viewer);
  const tracks = items.map((item) => ({ item, play: trackViewToPlayView(item.track) }));

  return (
    <Screen back pageTitle={playlist.name}>
      {editing ? (
        <EditPlaylist playlist={playlist} onDone={() => setEditing(false)} />
      ) : (
        <Glass className="gap-3 p-5">
          <View className="flex-row items-start gap-4">
            <AmbientSource uri={playlistCover(playlist) ?? coverUri(tracks[0]?.play.releaseMbId)}>
              <Cover uri={playlistCover(playlist)} releaseMbId={playlistCover(playlist) ? undefined : tracks[0]?.play.releaseMbId} size={112} radius={14} />
            </AmbientSource>
            <View className="min-w-0 flex-1 gap-1">
              <Heading level={1} size="title">
                {playlist.name}
              </Heading>
              <Text className="text-[14px] text-ink-2">
                {items.length} {items.length === 1 ? "song" : "songs"} · {playlist.authors.length}{" "}
                {playlist.authors.length === 1 ? "curator" : "curators"}
              </Text>
              <Link href={`/profile/${playlist.authorDid}`} asChild>
                <Pressable className="self-start">
                  <Text className="text-[14px] font-semibold text-tint">
                    By {playlist.author?.displayName || playlist.author?.handle || "its owner"}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </View>
          {playlist.description ? <RichText text={playlist.description} facets={playlist.descriptionFacets} className="text-[16px] leading-[22px] text-ink" /> : null}
          {isOwner ? <Button label="Edit playlist" size="sm" variant="secondary" onPress={() => setEditing(true)} /> : null}
        </Glass>
      )}

      {canAdd && !editing ? <AddSongs playlist={playlist} /> : null}

      <Section title="Songs" panel>
        {tracks.length === 0 ? (
          <Text className="py-2 text-ink-2">{canAdd ? "Empty so far. Add the first song above." : "No songs yet."}</Text>
        ) : (
          tracks.map(({ item, play }, i) => (
            <Row
              key={item.uri}
              // Playlist items aren't listens, so there's no listen to open; the album page always resolves.
              href={play.releaseMbId ? (musicAlbumHref(displayArtists(play) || "music", play.releaseName || "Album", play.releaseMbId) as never) : undefined}
              leading={
                <View className="flex-row items-center gap-3">
                  <Text className="w-6 text-center text-[13px] tabular-nums text-ink-2">{i + 1}</Text>
                  <Cover releaseMbId={play.releaseMbId} size={44} radius={8} />
                </View>
              }
              title={play.trackName}
              subtitle={[displayArtists(play) || "Unknown artist", play.releaseName].filter(Boolean).join(" · ")}
              divider={i < tracks.length - 1}
            />
          ))
        )}
      </Section>
    </Screen>
  );
}
