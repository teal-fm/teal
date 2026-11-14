import { useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Check, ListPlus } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { useActorPlaylists } from "@teal/client/hooks/useProfile";
import { usePdsAgent } from "@teal/client/session";
import { getActorPlaylists, getPlaylist } from "@teal/client/teal/api";
import { addPlaylistItem } from "@teal/client/teal/playlists";
import { useViewerDid } from "@teal/client/teal/queries";
import { playViewToTrackView } from "@teal/client/teal/social";
import { Button, Glass, Icon, LinkButton, Row } from "~/ds";

/** Add this song to one of your playlists. Opens a short list of them in place. */
export function AddToPlaylist({ play }: { play: PlayView }) {
  const viewer = useViewerDid();
  const agent = usePdsAgent();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const playlists = useActorPlaylists(open ? viewer : undefined);
  const items = playlists.data?.pages.flatMap((p) => p.items) ?? [];

  if (!viewer) return null;

  const add = async (playlist: (typeof items)[number]) => {
    if (!agent || busy) return;
    setBusy(playlist.uri);
    setError(false);
    try {
      const item = await addPlaylistItem(agent, playlist, playViewToTrackView(play), playlist.itemCount);
      setAdded((current) => new Set(current).add(playlist.uri));
      // The index lags writes, so update the cached playlist rather than refetching it.
      // Load the playlist first if it isn't cached, so opening it next shows the new song too.
      const key = ["playlist", playlist.uri];
      if (!client.getQueryData(key)) await client.fetchQuery({ queryKey: key, queryFn: () => getPlaylist(playlist.uri) }).catch(() => undefined);
      client.setQueryData<Awaited<ReturnType<typeof getPlaylist>>>(key, (data) =>
        data && !data.items.some((i) => i.uri === item.uri)
          ? { ...data, playlist: { ...data.playlist, itemCount: data.playlist.itemCount + 1 }, items: [...data.items, item] }
          : data,
      );
      // The picker's counts also give the next item its order, so bump them too.
      client.setQueriesData<InfiniteData<Awaited<ReturnType<typeof getActorPlaylists>>>>({ queryKey: ["actor-playlists", viewer] }, (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((p) => (p.uri === playlist.uri ? { ...p, itemCount: p.itemCount + 1 } : p)),
          })),
        },
      );
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button label="Add to playlist" icon={ListPlus} variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open ? (
        <Glass strong className="w-80 max-w-full px-4 py-1">
          {playlists.isLoading ? (
            <p className="py-3 text-ink-2">Loading your playlists…</p>
          ) : !items.length ? (
            <div className="flex flex-col gap-2 py-3">
              <p className="text-ink-2">You don't have any playlists yet.</p>
              <LinkButton href={`/profile/${viewer}?tab=playlists`} label="Make one" size="sm" variant="secondary" />
            </div>
          ) : (
            items.map((playlist, i) => (
              <Row
                key={playlist.uri}
                onClick={added.has(playlist.uri) ? undefined : () => add(playlist)}
                title={playlist.name}
                subtitle={
                  added.has(playlist.uri)
                    ? "Added"
                    : busy === playlist.uri
                      ? "Adding…"
                      : `${playlist.itemCount} ${playlist.itemCount === 1 ? "track" : "tracks"}`
                }
                label={added.has(playlist.uri) ? `${playlist.name}, added` : `Add to ${playlist.name}`}
                trailing={added.has(playlist.uri) ? <Icon icon={Check} size={18} className="text-tint" /> : null}
                divider={i < items.length - 1}
              />
            ))
          )}
          {error ? (
            <p role="alert" className="pb-3 text-[14px] text-destructive">
              That didn't save. Try again.
            </p>
          ) : null}
        </Glass>
      ) : null}
    </div>
  );
}
