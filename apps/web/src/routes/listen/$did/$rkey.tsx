import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Pencil } from "lucide-react";
import type { PlayView } from "@teal/lexicons/src/fm/teal/feed/defs";
import type { Main as PlayRecord } from "@teal/lexicons/src/fm/teal/feed/play";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import { patchActorPlays } from "@teal/client/hooks/useProfile";
import { useRecordingArt } from "@teal/client/hooks/useRecordingArt";
import { removePendingListens, retainConfirmedListens, retireIndexedListens, usePendingListens } from "@teal/client/pendingListenStore";
import { usePdsAgent } from "@teal/client/session";
import { coverArtUrl, displayArtists, getPlayByAuthorRkey, XrpcError } from "@teal/client/teal/api";
import { readListenDetail } from "@teal/client/teal/listenReadback";
import { applyEditableFields, artistTextFromRecord, deletePlayRecord, loadPlayRecord, putPlayRecord, type EditablePlayRecord } from "@teal/client/teal/playRecords";
import { useReactionsQuery, useViewerDid } from "@teal/client/teal/queries";
import { musicAlbumHref, musicArtistHref, musicTrackHref } from "@teal/client/teal/routes";
import { shortAgo } from "@teal/client/teal/today";
import { A, Avatar, Button, ButtonRow, ErrorNotice, Field, Glass, Heading, LinkButton, Loading, Notice, Screen } from "~/ds";
import { listenedAt } from "~/components/listen/ListenRow";
import { MusicHero } from "~/components/music/MusicHero";
import { ReactionBar } from "~/components/today/ReactionBar";
import { once, pageMeta, serverAwait } from "~/lib/meta";

const listenKey = (did: string, rkey: string, viewer?: string) => ["listen", did, rkey, viewer ?? null] as const;

export const Route = createFileRoute("/listen/$did/$rkey")({
  loader: ({ params, context: { queryClient } }) =>
    serverAwait(async () => {
      const { play } = await queryClient.ensureQueryData(once({
        queryKey: listenKey(params.did, params.rkey),
        queryFn: () => readListenDetail(params.did, params.rkey, undefined, () => undefined, getPlayByAuthorRkey),
      }));
      if (!play) return undefined;
      const artists = displayArtists(play) || "Unknown artist";
      return {
        title: `${play.trackName} · ${artists}`,
        description: [play.releaseName, "A listen on Teal"].filter(Boolean).join(" · "),
        image: coverArtUrl(play.releaseMbId, 500),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Listen · Teal" }] }),
  component: ListenScreen,
});

/** Fix the track, artists, album, or time of your own listen. Reads the record first so a stale view can't overwrite it. */
function EditListen({ did, rkey, uri, onSaved, onCancel }: { did: string; rkey: string; uri: string; onSaved: () => void; onCancel: () => void }) {
  const agent = usePdsAgent();
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

  const save = async (event: FormEvent) => {
    event.preventDefault();
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
  const set = (key: keyof typeof fields) => (event: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: event.target.value }));
  return (
    <Glass strong as="section" className="p-4">
      <form onSubmit={save} className="flex flex-col gap-3">
        <Heading level={2}>Edit listen</Heading>
        <Field label="Track" value={fields.trackName} onChange={set("trackName")} />
        <Field label="Artists" hint="Separate several with commas." value={fields.artistsText} onChange={set("artistsText")} />
        <Field label="Album" value={fields.releaseName} onChange={set("releaseName")} />
        <Field label="Played at" hint="A date and time, such as 2026-11-04T18:30:00Z." value={fields.playedTime} onChange={set("playedTime")} autoCapitalize="none" />
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
        <ButtonRow>
          <Button type="submit" label={busy ? "Saving" : "Save"} loading={busy} />
          <Button label="Cancel" variant="secondary" onClick={onCancel} />
        </ButtonRow>
      </form>
    </Glass>
  );
}

/** One listen: what was played, by whom and when, with reactions, and editing for its owner. */
function ListenScreen() {
  const { did, rkey } = Route.useParams();
  const uri = `at://${did}/fm.teal.feed.play/${rkey}`;
  const viewer = useViewerDid();
  const agent = usePdsAgent();
  const client = useQueryClient();
  const pending = usePendingListens(viewer === did ? viewer : undefined);
  const [editing, setEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  const listen = useQuery({
    queryKey: listenKey(did, rkey, viewer),
    enabled: !deleted,
    queryFn: async () => {
      const result = await readListenDetail(did, rkey, viewer, () => pending.find((e) => e.play.uri === uri)?.play, getPlayByAuthorRkey);
      if (viewer === did && result.indexed) retireIndexedListens(did, [result.indexed]);
      return result;
    },
  });
  const play: PlayView | undefined = listen.data?.play;
  const author = useDisplayActor(play?.author as never, did);
  const reactions = useReactionsQuery(play?.uri);
  const recordingArt = useRecordingArt(play);
  const isOwn = !!viewer && viewer === did;

  const remove = async () => {
    if (!agent) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteError(false);
    try {
      await deletePlayRecord(agent, did, rkey);
      removePendingListens(did, [uri]);
      setDeleted(true);
      patchActorPlays(client, did, (p) => (p.rkey === rkey ? null : p));
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
        imageUri={recordingArt}
        title={play.trackName}
        lines={[
          play.artists?.[0]?.artistMbId ? (
            <A href={musicArtistHref(artists, play.artists[0].artistMbId)} className="halo text-[18px] font-semibold text-ink hover:underline">
              {artists}
            </A>
          ) : (
            artists
          ),
          play.releaseName && play.releaseMbId ? (
            <A href={musicAlbumHref(artists, play.releaseName, play.releaseMbId)} className="halo text-[16px] text-ink-2 hover:underline">
              {play.releaseName}
            </A>
          ) : (
            (play.releaseName ?? "")
          ),
        ]}
        actions={
          <>
            <LinkButton href={musicTrackHref(artists, play.releaseName, play.trackName, play.uri)} label="Song page" variant="secondary" />
            {play.originUri ? <LinkButton href={play.originUri} target="_blank" label="Listen" icon={ArrowUpRight} /> : null}
          </>
        }
      />

      <Glass className="flex flex-col gap-3 p-4">
        <A href={author.href} className="flex items-center gap-3 self-start hover:opacity-85">
          <Avatar did={did} avatar={author.avatar} name={author.name} size={44} />
          <span className="flex flex-col">
            <span className="font-semibold">{author.name}</span>
            <span className="text-[14px] text-ink-2" suppressHydrationWarning>
              {listen.data?.syncing
                ? "Saved, syncing"
                : `listened ${play.playedTime ? `${shortAgo(play.playedTime)} ago · ${listenedAt(play.playedTime)}` : "recently"}`}
            </span>
          </span>
        </A>
        {play.uri && play.cid ? (
          <div className="border-t border-hair pt-3">
            <ReactionBar subject={{ uri: play.uri, cid: play.cid }} reactions={reactions.data ?? []} />
          </div>
        ) : null}
        {isOwn && !editing ? (
          <div className="flex flex-col gap-2 border-t border-hair pt-3">
            <ButtonRow>
              <Button label="Edit" icon={Pencil} size="sm" variant="secondary" onClick={() => setEditing(true)} />
              <Button label={confirmDelete ? "Delete? Press again" : "Delete"} size="sm" variant="destructive" onClick={remove} />
            </ButtonRow>
            {deleteError ? (
              <p role="alert" className="text-[14px] text-destructive">
                The listen wasn't deleted. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </Glass>

      {editing ? (
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
