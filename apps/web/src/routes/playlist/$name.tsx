import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ListMusic, Plus } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import getImageCdnLink from "@teal/client/atp/getImageCdnLink";
import { usePdsAgent } from "@teal/client/session";
import { displayArtists, getPlaylist, getProfile, type SocialPlaylistView } from "@teal/client/teal/api";
import { MAX_PLAYLIST_COLLABORATORS, resolvePlaylistAuthors } from "@teal/client/teal/playlistEditing";
import { addPlaylistItem, savePlaylistRecord } from "@teal/client/teal/playlists";
import { useViewerDid } from "@teal/client/teal/queries";
import { musicAlbumHref, playlistHrefFromUri } from "@teal/client/teal/routes";
import { playViewToTrackView, trackViewToPlayView } from "@teal/client/teal/social";
import { A, AmbientSource, Button, ButtonRow, Cover, coverUri, ErrorNotice, Field, Glass, Heading, Loading, Notice, Row, Screen, Section, TextArea } from "~/ds";
import { TrackPicker } from "~/components/compose/TrackPicker";
import { RichText } from "~/components/post/RichText";
import { ImagePick } from "~/components/profile/ImagePick";
import { once, pageMeta, serverAwait } from "~/lib/meta";
import { pickStrings } from "~/lib/search";

const playlistQuery = (uri: string) => ({ queryKey: ["playlist", uri] as const, queryFn: () => getPlaylist(uri) });

function playlistCover(playlist: SocialPlaylistView) {
  return playlist.coverCid ? getImageCdnLink({ did: playlist.authorDid, hash: playlist.coverCid }) : undefined;
}

export const Route = createFileRoute("/playlist/$name")({
  validateSearch: (search: Record<string, unknown>) => pickStrings(search, "uri"),
  loaderDeps: ({ search }) => ({ uri: search.uri }),
  loader: ({ deps, context: { queryClient } }) =>
    serverAwait(async () => {
      if (!deps.uri || !playlistHrefFromUri(deps.uri)) return undefined;
      const { playlist, items } = await queryClient.ensureQueryData(once(playlistQuery(deps.uri)));
      const by = playlist.author?.displayName || playlist.author?.handle;
      return {
        title: playlist.name,
        description: playlist.description || `${items.length} songs${by ? ` · by ${by}` : ""}`,
        image: playlistCover(playlist),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Playlist · Teal" }] }),
  component: PlaylistScreen,
});

function EditPlaylist({ playlist, onDone }: { playlist: SocialPlaylistView; onDone: () => void }) {
  const agent = usePdsAgent();
  const client = useQueryClient();
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || "");
  const [collaborators, setCollaborators] = useState(playlist.authors.filter((did) => did !== playlist.authorDid).join("\n"));
  const [cover, setCover] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: FormEvent) => {
    event.preventDefault();
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
    <Glass strong as="section" className="p-4">
      <form onSubmit={save} className="flex flex-col gap-3">
        <ImagePick label="Change cover" onPick={setCover} className="flex flex-col items-start self-start">
          <Cover uri={cover ?? playlistCover(playlist)} size={120} radius={14} />
          <span className="mt-1 text-[13px] font-semibold text-tint">Change cover</span>
        </ImagePick>
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
        <TextArea
          label="Collaborators"
          hint={`Collaborators can add songs. Up to ${MAX_PLAYLIST_COLLABORATORS} handles, one per line.`}
          value={collaborators}
          onChange={(e) => setCollaborators(e.target.value)}
          placeholder="listener.bsky.social"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
        <ButtonRow>
          <Button type="submit" label={busy ? "Saving" : "Save"} loading={busy} disabled={!name.trim()} />
          <Button label="Cancel" variant="secondary" onClick={onDone} />
        </ButtonRow>
      </form>
    </Glass>
  );
}

/** Add songs: what you're playing now, or anything from your history or MusicBrainz. */
function AddSongs({ playlist }: { playlist: SocialPlaylistView }) {
  const viewer = useViewerDid();
  const agent = usePdsAgent();
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
      const item = await addPlaylistItem(agent, playlist, playViewToTrackView(play), playlist.itemCount);
      // The index lags writes, so the new song joins the cached playlist straight away.
      client.setQueryData<Awaited<ReturnType<typeof getPlaylist>>>(["playlist", playlist.uri], (data) =>
        data && { ...data, playlist: { ...data.playlist, itemCount: data.playlist.itemCount + 1 }, items: [...data.items, item] },
      );
      setStatus(`Added ${play.trackName}.`);
      setSelected(null);
    } catch {
      setStatus("That song wasn't added. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ButtonRow>
        {nowPlaying.data ? <Button label={`Add ${nowPlaying.data.trackName}`} icon={Plus} size="sm" loading={busy} onClick={() => add(nowPlaying.data!)} /> : null}
        <Button label={open ? "Close" : "Find a song"} icon={ListMusic} size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      </ButtonRow>
      {status ? (
        <p role="status" className="text-[14px] text-ink-2">
          {status}
        </p>
      ) : null}
      {open ? (
        <Glass strong className="flex flex-col gap-3 p-4">
          <TrackPicker selected={selected} onSelect={setSelected} />
          <Button label="Add to playlist" disabled={!selected} loading={busy} onClick={() => selected && add(selected)} />
        </Glass>
      ) : null}
    </div>
  );
}

/** A playlist: its cover and description, who curates it, and its songs. */
function PlaylistScreen() {
  const { uri } = Route.useSearch();
  const viewer = useViewerDid();
  const valid = !!playlistHrefFromUri(uri);
  const [editing, setEditing] = useState(false);
  const query = useQuery({ ...playlistQuery(uri ?? ""), enabled: valid });

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
  // Alpha-era playlists aren't re-indexed when edited, so an edit would look like it reverted.
  const legacy = playlist.uri.includes("/fm.teal.alpha.");
  const canAdd = !!viewer && playlist.authors.includes(viewer);
  const tracks = items.map((item) => ({ item, play: trackViewToPlayView(item.track) }));

  return (
    <Screen back pageTitle={playlist.name}>
      {editing ? (
        <EditPlaylist playlist={playlist} onDone={() => setEditing(false)} />
      ) : (
        <Glass as="header" className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-4">
            <AmbientSource uri={playlistCover(playlist) ?? coverUri(tracks[0]?.play.releaseMbId)}>
              <Cover uri={playlistCover(playlist)} releaseMbId={playlistCover(playlist) ? undefined : tracks[0]?.play.releaseMbId} size={112} radius={14} eager />
            </AmbientSource>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Heading level={1} size="title">
                {playlist.name}
              </Heading>
              <p className="text-[14px] text-ink-2">
                {items.length} {items.length === 1 ? "song" : "songs"} · {playlist.authors.length} {playlist.authors.length === 1 ? "curator" : "curators"}
              </p>
              <A href={`/profile/${playlist.authorDid}`} className="self-start text-[14px] font-semibold text-tint hover:underline">
                By {playlist.author?.displayName || playlist.author?.handle || "its owner"}
              </A>
            </div>
          </div>
          {playlist.description ? <RichText text={playlist.description} facets={playlist.descriptionFacets} className="text-[16px] leading-[22px] text-ink" /> : null}
          {isOwner && !legacy ? <Button label="Edit playlist" size="sm" variant="secondary" onClick={() => setEditing(true)} /> : null}
          {isOwner && legacy ? (
            <p className="text-[13px] text-ink-2">
              This playlist was made before teal's current format, so its details can't be edited here yet. You can still add songs.
            </p>
          ) : null}
        </Glass>
      )}

      {canAdd && !editing ? <AddSongs playlist={playlist} /> : null}

      <Section title="Songs" panel>
        {tracks.length === 0 ? (
          <p className="py-2 text-ink-2">{canAdd ? "Empty so far. Add the first song above." : "No songs yet."}</p>
        ) : (
          <ol>
            {tracks.map(({ item, play }, i) => (
              <li key={item.uri}>
                <Row
                  // Playlist items aren't listens, so there's no listen to open; the album page always resolves.
                  href={play.releaseMbId ? musicAlbumHref(displayArtists(play) || "music", play.releaseName || "Album", play.releaseMbId) : undefined}
                  leading={
                    <span className="flex items-center gap-3">
                      <span className="w-6 text-center text-[13px] tabular-nums text-ink-2">{i + 1}</span>
                      <Cover releaseMbId={play.releaseMbId} size={44} radius={8} ambient />
                    </span>
                  }
                  title={play.trackName}
                  subtitle={[displayArtists(play) || "Unknown artist", play.releaseName].filter(Boolean).join(" · ")}
                  divider={i < tracks.length - 1}
                />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </Screen>
  );
}
