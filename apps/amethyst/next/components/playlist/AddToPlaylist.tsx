import { useState } from "react";
import { View } from "react-native";
import { Link } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ListPlus } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { addPlaylistItem } from "@/lib/teal/playlists";
import { useViewerDid } from "@/lib/teal/queries";
import { playViewToTrackView } from "@/lib/teal/social";
import { Button, Glass, Icon, Row, Text } from "@/next/components/ds";
import { useActorPlaylists } from "@/next/hooks/useProfile";
import { useStore } from "@/stores/mainStore";

/** Add this song to one of your playlists. Opens a short list of them in place. */
export function AddToPlaylist({ play }: { play: PlayView }) {
  const viewer = useViewerDid();
  const agent = useStore((state) => state.pdsAgent);
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
      await addPlaylistItem(agent, playlist, playViewToTrackView(play), playlist.itemCount);
      setAdded((current) => new Set(current).add(playlist.uri));
      void client.invalidateQueries({ queryKey: ["actor-playlists", viewer] });
      void client.invalidateQueries({ queryKey: ["playlist", playlist.uri] });
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="gap-2">
      <Button label="Add to playlist" icon={ListPlus} variant="secondary" aria-expanded={open} onPress={() => setOpen((o) => !o)} />
      {open ? (
        <Glass strong className="w-80 max-w-full px-4 py-1">
          {playlists.isLoading ? (
            <Text className="py-3 text-ink-2">Loading your playlists…</Text>
          ) : !items.length ? (
            <View className="gap-2 py-3">
              <Text className="text-ink-2">You don't have any playlists yet.</Text>
              <Link href={`/profile/${viewer}?tab=playlists`} asChild>
                <Button label="Make one" size="sm" variant="secondary" />
              </Link>
            </View>
          ) : (
            items.map((playlist, i) => (
              <Row
                key={playlist.uri}
                onPress={added.has(playlist.uri) ? undefined : () => add(playlist)}
                title={playlist.name}
                subtitle={added.has(playlist.uri) ? "Added" : busy === playlist.uri ? "Adding…" : `${playlist.itemCount} ${playlist.itemCount === 1 ? "track" : "tracks"}`}
                label={added.has(playlist.uri) ? `${playlist.name}, added` : `Add to ${playlist.name}`}
                trailing={added.has(playlist.uri) ? <Icon icon={Check} size={18} className="text-tint" /> : null}
                divider={i < items.length - 1}
              />
            ))
          )}
          {error ? (
            <Text role="alert" className="pb-3 text-[14px] text-destructive">
              That didn't save. Try again.
            </Text>
          ) : null}
        </Glass>
      ) : null}
    </View>
  );
}
