import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { ListChecks, Plus } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import { updateSelectedPlayRecords } from "@/lib/teal/bulkPlayRecords";
import { mergePendingListens } from "@/lib/teal/pendingListens";
import { artistsFromText, deletePlayRecord, loadPlayRecord, putPlayRecord } from "@/lib/teal/playRecords";
import { Button, ButtonRow, ErrorNotice, Field, Glass, Heading, Loading, Notice, Text } from "@/next/components/ds";
import { ListenRow } from "@/next/components/listen/ListenRow";
import { useActorPlays } from "@/next/hooks/useProfile";
import { useStore } from "@/stores/mainStore";
import {
  removePendingListens,
  retainConfirmedListens,
  retireIndexedListens,
  usePendingListens,
} from "@/stores/pendingListenStore";

/** Indexed plays plus your own listens that are saved but not indexed yet. */
export function usePlaysWithPending(did: string, isSelf: boolean) {
  const query = useActorPlays(did);
  const indexed = useMemo(() => query.data?.pages.flatMap((p) => p.plays) ?? [], [query.data]);
  const pending = usePendingListens(isSelf ? did : null);
  const plays = useMemo(() => mergePendingListens(did, indexed, pending), [did, indexed, pending]);
  const syncing = useMemo(
    () =>
      new Set(
        pending
          .filter((entry) => !indexed.some((play) => play.uri === entry.play.uri && play.cid === entry.play.cid))
          .map((entry) => entry.play.uri as string),
      ),
    [pending, indexed],
  );
  useEffect(() => {
    if (isSelf) retireIndexedListens(did, indexed);
  }, [did, indexed, isSelf]);
  return { query, indexed, plays, syncing };
}

/** Select listens on your own profile, then fix their artists or album, or delete them. */
function BulkEditor({
  did,
  plays,
  syncing,
  onDone,
}: {
  did: string;
  plays: PlayView[];
  syncing: Set<string>;
  onDone: () => void;
}) {
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [artists, setArtists] = useState("");
  const [release, setRelease] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = plays.filter((play) => play.rkey && !syncing.has(play.uri ?? ""));
  const refresh = () => client.invalidateQueries({ queryKey: ["actor-plays", did] });

  const toggle = (rkey: string) => {
    setConfirmDelete(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rkey)) next.delete(rkey);
      else next.add(rkey);
      return next;
    });
  };

  const apply = async () => {
    if (!agent || !selected.size || busy) return;
    if (!artists.trim() && !release.trim()) {
      setError("Enter artists or an album name first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateSelectedPlayRecords(
        [...selected],
        {
          ...(artists.trim() ? { artists: artistsFromText(artists.trim()) } : {}),
          ...(release.trim() ? { releaseName: release.trim() } : {}),
        },
        {
          load: (rkey) => loadPlayRecord(agent, did, rkey),
          put: (rkey, record, cid) => putPlayRecord(agent, did, rkey, record, cid),
          confirmed: (write) => retainConfirmedListens(did, [write]),
        },
      );
      setSelected(new Set());
      setArtists("");
      setRelease("");
      await refresh();
    } catch {
      setError("Some listens didn't update. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!agent || !selected.size || busy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const rkey of selected) {
        await deletePlayRecord(agent, did, rkey);
        removePendingListens(did, [`at://${did}/fm.teal.feed.play/${rkey}`]);
      }
      setSelected(new Set());
      setConfirmDelete(false);
      await refresh();
    } catch {
      setError("Some listens didn't delete. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-3">
      <Glass strong className="gap-3 p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-semibold" aria-live="polite">
            {selected.size} selected
          </Text>
          <ButtonRow>
            <Button
              label="Select all shown"
              size="sm"
              variant="secondary"
              onPress={() => setSelected(new Set(editable.map((p) => p.rkey!)))}
            />
            <Button label="Done" size="sm" variant="plain" onPress={onDone} />
          </ButtonRow>
        </View>
        <Field label="Artists" hint="Separate several with commas." value={artists} onChangeText={setArtists} />
        <Field label="Album" value={release} onChangeText={setRelease} />
        {error ? (
          <Text role="alert" className="text-[14px] text-destructive">
            {error}
          </Text>
        ) : null}
        <ButtonRow>
          <Button label="Apply to selected" size="sm" disabled={!selected.size} loading={busy} onPress={apply} />
          <Button
            label={confirmDelete ? `Delete ${selected.size}? Tap again` : "Delete selected"}
            size="sm"
            variant="destructive"
            disabled={!selected.size || busy}
            onPress={remove}
          />
        </ButtonRow>
      </Glass>
      <Glass className="px-4">
        {editable.map((play, i) => (
          <ListenRow
            key={play.uri}
            play={play}
            selecting
            selected={selected.has(play.rkey!)}
            onToggle={() => toggle(play.rkey!)}
            last={i === editable.length - 1}
          />
        ))}
      </Glass>
    </View>
  );
}

/** The listening tab: someone's full history, newest first. */
export function ListeningHistory({ did, isSelf }: { did: string; isSelf: boolean }) {
  const { query, plays, syncing } = usePlaysWithPending(did, isSelf);
  const [editing, setEditing] = useState(false);

  if (query.isLoading) return <Loading />;
  if (query.isError) return <ErrorNotice title="Listening history didn't load" onRetry={() => query.refetch()} />;

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Heading level={2} onBackdrop>
          Listening history
        </Heading>
        {isSelf ? (
          <ButtonRow>
            <Link href="/stamp" asChild>
              <Button label="Add a listen" icon={Plus} size="sm" variant="secondary" />
            </Link>
            {plays.length ? (
              <Button
                label={editing ? "Stop editing" : "Edit listens"}
                icon={ListChecks}
                size="sm"
                variant="secondary"
                aria-pressed={editing}
                onPress={() => setEditing((on) => !on)}
              />
            ) : null}
          </ButtonRow>
        ) : null}
      </View>
      {plays.length === 0 ? (
        <Notice
          title="No listens yet"
          body={isSelf ? "Connect a scrobbler or add a listen, and your history shows up here." : "Nothing here yet."}
        />
      ) : editing ? (
        <BulkEditor did={did} plays={plays} syncing={syncing} onDone={() => setEditing(false)} />
      ) : (
        <Glass className="px-4">
          {plays.map((play, i) => (
            <ListenRow key={play.uri} play={play} syncing={syncing.has(play.uri ?? "")} last={i === plays.length - 1} />
          ))}
        </Glass>
      )}
      {query.hasNextPage && !editing ? (
        <Button
          label={query.isFetchingNextPage ? "Loading" : "Load more"}
          variant="secondary"
          className="self-center"
          loading={query.isFetchingNextPage}
          onPress={() => query.fetchNextPage()}
        />
      ) : null}
    </View>
  );
}
