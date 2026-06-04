import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { playViewToTrackView } from "@/lib/teal/social";
import { useStore } from "@/stores/mainStore";

import type {
  SocialPlaylistItemView,
  SocialPlaylistView,
} from "@/lib/teal/api";
import type { PlayView } from "@teal/lexicons/src/types/fm/teal/alpha/feed/defs";

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
        authors: [pdsAgent.did],
        createdAt: new Date().toISOString(),
      };
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
}: {
  playlist: Pick<SocialPlaylistView, "uri" | "cid">;
  track?: PlayView | null;
  order: number;
  onAdded: (item: SocialPlaylistItemView) => void;
}) {
  const pdsAgent = useStore((state) => state.pdsAgent);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!pdsAgent?.did || !track || busy) return;
    setBusy(true);
    try {
      const record = {
        $type: "fm.teal.alpha.feed.social.playlistItem",
        subject: { uri: playlist.uri, cid: playlist.cid },
        track: playViewToTrackView(track),
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button disabled={!track || busy} onPress={add}>
      <Text>{busy ? "Adding..." : "Add current track"}</Text>
    </Button>
  );
}
