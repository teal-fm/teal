import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Pencil } from "lucide-react-native";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";
import { displayArtists, getPlayByAuthorRkey, XrpcError } from "@/lib/teal/api";
import { readListenDetail } from "@/lib/teal/listenReadback";
import {
  applyEditableFields,
  artistTextFromRecord,
  deletePlayRecord,
  loadPlayRecord,
  putPlayRecord,
  type EditablePlayRecord,
} from "@/lib/teal/playRecords";
import { useReactionsQuery, useViewerDid } from "@/lib/teal/queries";
import { musicAlbumHref, musicArtistHref, musicTrackHref } from "@/lib/teal/routes";
import { shortAgo } from "@/lib/teal/today";
import {
  Avatar,
  Button,
  ButtonRow,
  ErrorNotice,
  Field,
  Glass,
  Heading,
  Loading,
  Notice,
  Screen,
  Text,
} from "@/next/components/ds";
import { listenedAt } from "@/next/components/listen/ListenRow";
import { MusicHero } from "@/next/components/music/MusicHero";
import { ReactionBar } from "@/next/components/today/ReactionBar";
import { useDisplayActor } from "@/next/hooks/useDisplayActor";
import { useStore } from "@/stores/mainStore";
import { removePendingListens, retainConfirmedListens, retireIndexedListens, usePendingListens } from "@/stores/pendingListenStore";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Fix the track, artists, album, or time of your own listen. Reads the record first so a stale view can't overwrite it. */
function EditListen({
  did,
  rkey,
  uri,
  onSaved,
  onCancel,
}: {
  did: string;
  rkey: string;
  uri: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const agent = useStore((state) => state.pdsAgent);
  const [source, setSource] = useState<{ record: EditablePlayRecord; cid?: string } | null>(null);
  const [fields, setFields] = useState({ trackName: "", artistsText: "", releaseName: "", playedTime: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    loadPlayRecord(agent, did, rkey)
      .then((loaded) => {
        setSource({ record: loaded.record, cid: loaded.swapRecord });
        setFields({
          trackName: loaded.record.trackName,
          artistsText: artistTextFromRecord(loaded.record),
          releaseName: loaded.record.releaseName || "",
          playedTime: loaded.record.playedTime || "",
        });
      })
      .catch(() => setError("The editor didn't open. Your listen hasn't changed. Try again."));
  }, [agent, did, rkey]);

  const save = async () => {
    if (!agent || !source || busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = applyEditableFields(source.record, fields);
      const receipt = await putPlayRecord(agent, did, rkey, record, source.cid);
      removePendingListens(did, [uri]);
      if (receipt.uri === uri && receipt.cid) {
        retainConfirmedListens(did, [{ record: { ...record, $type: "fm.teal.feed.play" } as PlayRecord, ...receipt }]);
      }
      onSaved();
    } catch (e) {
      // applyEditableFields explains invalid input; anything else is a save failure.
      setError(e instanceof Error && /required|valid|date/i.test(e.message) ? e.message : "Your changes didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!source) return error ? <ErrorNotice title="The editor didn't open" body={error} /> : <Loading className="py-8" />;
  const set = (key: keyof typeof fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));
  return (
    <Glass strong className="gap-3 p-4">
      <Heading level={2}>Edit listen</Heading>
      <Field label="Track" value={fields.trackName} onChangeText={set("trackName")} />
      <Field label="Artists" hint="Separate several with commas." value={fields.artistsText} onChangeText={set("artistsText")} />
      <Field label="Album" value={fields.releaseName} onChangeText={set("releaseName")} />
      <Field label="Played at" hint="A date and time, such as 2026-11-04T18:30:00Z." value={fields.playedTime} onChangeText={set("playedTime")} autoCapitalize="none" />
      {error ? (
        <Text role="alert" className="text-[14px] text-destructive">
          {error}
        </Text>
      ) : null}
      <ButtonRow>
        <Button label={busy ? "Saving" : "Save"} loading={busy} onPress={save} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </ButtonRow>
    </Glass>
  );
}

/** One listen: what was played, by whom and when, with reactions, and editing for its owner. */
export default function ListenScreen() {
  const params = useLocalSearchParams();
  const did = param(params.did);
  const rkey = param(params.rkey);
  const uri = did && rkey ? `at://${did}/fm.teal.feed.play/${rkey}` : undefined;
  const viewer = useViewerDid();
  const agent = useStore((state) => state.pdsAgent);
  const client = useQueryClient();
  const pending = usePendingListens(viewer === did ? viewer : undefined);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const listen = useQuery({
    queryKey: ["listen", did, rkey, viewer ?? null],
    enabled: !!did && !!rkey && !deleted,
    queryFn: async () => {
      const result = await readListenDetail(did!, rkey!, viewer, () => pending.find((e) => e.play.uri === uri)?.play, getPlayByAuthorRkey);
      if (viewer === did && result.indexed) retireIndexedListens(did!, [result.indexed]);
      return result;
    },
  });
  const play: PlayView | undefined = listen.data?.play;
  const author = useDisplayActor(play?.author as never, did);
  const reactions = useReactionsQuery(play?.uri);
  const isOwn = !!viewer && viewer === did;

  const remove = async () => {
    if (!agent || !did || !rkey || !uri) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteError(false);
    try {
      await deletePlayRecord(agent, did, rkey);
      removePendingListens(did, [uri]);
      setDeleted(true);
      void client.invalidateQueries({ queryKey: ["actor-plays", did] });
    } catch {
      setDeleteError(true);
    }
  };

  if (deleted) {
    return (
      <Screen back pageTitle="Listen deleted">
        <Notice title="Listen deleted" body="It's gone from your account. Public feeds may take a moment to catch up." />
      </Screen>
    );
  }
  if (!did || !rkey) {
    return (
      <Screen back pageTitle="Listen">
        <Notice title="This listen link is incomplete" body="Check the link and try again." />
      </Screen>
    );
  }
  if (listen.isLoading) {
    return (
      <Screen back pageTitle="Listen">
        <Loading />
      </Screen>
    );
  }
  if (listen.isError || !play) {
    const missing = listen.error instanceof XrpcError && listen.error.status === 404;
    return (
      <Screen back pageTitle="Listen">
        <ErrorNotice
          title={missing ? "This listen isn't available" : "This listen didn't load"}
          body={missing ? "Check the link, or try again in a moment." : undefined}
          onRetry={() => listen.refetch()}
        />
      </Screen>
    );
  }

  const artists = displayArtists(play) || "Unknown artist";
  return (
    <Screen back pageTitle={`${play.trackName} · ${artists}`} width="wide">
      <MusicHero
        releaseMbId={play.releaseMbId}
        title={play.trackName}
        lines={[
          play.artists?.[0]?.artistMbId ? (
            <Link href={musicArtistHref(artists, play.artists[0].artistMbId) as never} asChild>
              <Pressable className="self-start">
                <Text onBackdrop className="text-[18px] font-semibold">
                  {artists}
                </Text>
              </Pressable>
            </Link>
          ) : (
            artists
          ),
          play.releaseName && play.releaseMbId ? (
            <Link href={musicAlbumHref(artists, play.releaseName, play.releaseMbId) as never} asChild>
              <Pressable className="self-start">
                <Text onBackdrop className="text-[16px] text-ink-2">
                  {play.releaseName}
                </Text>
              </Pressable>
            </Link>
          ) : (
            play.releaseName ?? ""
          ),
        ]}
        actions={
          <>
            <Link href={musicTrackHref(artists, play.releaseName, play.trackName, play.uri) as never} asChild>
              <Button label="Song page" variant="secondary" />
            </Link>
            {play.originUri ? <Button label="Listen" icon={ArrowUpRight} onPress={() => Linking.openURL(play.originUri as string)} /> : null}
          </>
        }
      />

      <Glass className="gap-3 p-4">
        <Link href={author.href as never} asChild>
          <Pressable className="flex-row items-center gap-3 self-start">
            <Avatar did={did} avatar={author.avatar} name={author.name} size={44} />
            <View>
              <Text className="font-semibold">{author.name}</Text>
              <Text className="text-[14px] text-ink-2">
                {listen.data?.syncing ? "Saved, syncing" : `listened ${play.playedTime ? `${shortAgo(play.playedTime)} ago · ${listenedAt(play.playedTime)}` : "recently"}`}
              </Text>
            </View>
          </Pressable>
        </Link>
        {play.uri && play.cid ? (
          <View className="border-t border-hair pt-3">
            <ReactionBar subject={{ uri: play.uri, cid: play.cid }} reactions={reactions.data ?? []} />
          </View>
        ) : null}
        {isOwn && !editing ? (
          <View className="gap-2 border-t border-hair pt-3">
            <ButtonRow>
              <Button label="Edit" icon={Pencil} size="sm" variant="secondary" onPress={() => setEditing(true)} />
              <Button label={confirmDelete ? "Delete? Tap again" : "Delete"} size="sm" variant="destructive" onPress={remove} />
            </ButtonRow>
            {deleteError ? (
              <Text role="alert" className="text-[14px] text-destructive">
                The listen wasn't deleted. Try again.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Glass>

      {editing && uri ? (
        <EditListen
          did={did}
          rkey={rkey}
          uri={uri}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void listen.refetch();
          }}
        />
      ) : null}
    </Screen>
  );
}
