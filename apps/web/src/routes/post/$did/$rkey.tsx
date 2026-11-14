import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, MessageCircle, Share, Trash2 } from "lucide-react";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import { usePdsAgent } from "@teal/client/session";
import { displayActorName } from "@teal/client/teal/actors";
import { coverArtUrl, getSocialPost, getSocialPostReplies, type SocialPostView } from "@teal/client/teal/api";
import { forgetPost, rememberPost, useViewerDid } from "@teal/client/teal/queries";
import { absoluteUrl, musicArtistHref, postHrefFromUri, postUriFromRoute } from "@teal/client/teal/routes";
import { socialPostDeleteParams, trackViewToPlayView } from "@teal/client/teal/social";
import { shortAgo } from "@teal/client/teal/today";
import { cn } from "@teal/client/utils";
import { A, AmbientSource, Avatar, Button, ButtonRow, Cover, coverUri, ErrorNotice, Glass, Heading, Icon, IconButton, LinkButton, Loading, Screen, useGoBack } from "~/ds";
import { Composer } from "~/components/compose/Composer";
import { RichText } from "~/components/post/RichText";
import { ReactionBar } from "~/components/today/ReactionBar";
import { shareLink } from "~/components/today/share";
import { pageMeta, serverAwait } from "~/lib/meta";

const postQuery = (uri: string, viewer?: string) => ({
  queryKey: ["post", uri, viewer ?? null] as const,
  queryFn: () => getSocialPost(uri, viewer).then((r) => r.post),
});

export const Route = createFileRoute("/post/$did/$rkey")({
  validateSearch: (search: Record<string, unknown>): { alpha?: string } => ({
    alpha: search.alpha === "1" || search.alpha === 1 ? "1" : undefined,
  }),
  loaderDeps: ({ search }) => ({ alpha: search.alpha }),
  loader: ({ params, deps, context: { queryClient } }) =>
    serverAwait(async () => {
      const uri = postUriFromRoute(params.did, params.rkey, deps.alpha)!;
      const post = await queryClient.ensureQueryData(postQuery(uri));
      const play = trackViewToPlayView(post.track);
      const name = post.author?.displayName || post.author?.handle || "Someone";
      const artist = play.artists?.[0]?.artistName;
      return {
        title: `${name} on ${play.trackName}`,
        description: post.text || [play.trackName, artist].filter(Boolean).join(" · "),
        image: coverArtUrl(play.releaseMbId, 500),
      };
    }),
  head: ({ loaderData }) => ({ meta: loaderData ? pageMeta(loaderData) : [{ title: "Post · Teal" }] }),
  component: PostScreen,
});

function Reply({ reply, last }: { reply: SocialPostView; last: boolean }) {
  const author = useDisplayActor(reply.author, reply.authorDid);
  return (
    <li className={cn("flex gap-3 py-3.5", !last && "border-b border-hair")}>
      <A href={author.href} aria-label={`${author.name}'s profile`} className="self-start">
        <Avatar did={author.did} avatar={author.avatar} name={author.name} size={36} />
      </A>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[15px] text-ink-2">
          <A href={author.href} className="font-semibold text-ink hover:underline">
            {author.name}
          </A>{" "}
          · <span suppressHydrationWarning>{shortAgo(reply.createdAt)}</span>
        </p>
        <RichText text={reply.text} facets={reply.facets} className="text-[16px] leading-[22px] text-ink" />
        <ReactionBar subject={{ uri: reply.uri, cid: reply.cid }} reactions={reply.reactions ?? []} />
      </div>
    </li>
  );
}

/** A song post: the song as the hero, then what was said, who reacted, and the conversation. */
function PostScreen() {
  const { did, rkey } = Route.useParams();
  const { alpha } = Route.useSearch();
  const uri = postUriFromRoute(did, rkey, alpha)!;
  const viewer = useViewerDid();
  const agent = usePdsAgent();
  const client = useQueryClient();
  const back = useGoBack();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const armed = useRef(false);
  // Keyboard focus follows the trash button into the confirmation, and back again on Cancel.
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.focus();
    else if (armed.current) trashRef.current?.focus();
    armed.current = confirmDelete;
  }, [confirmDelete]);

  const post = useQuery(postQuery(uri, viewer));
  const replies = useQuery({
    queryKey: ["replies", uri, viewer ?? null],
    queryFn: () => getSocialPostReplies(uri, 50, undefined, viewer).then((r) => r.items),
  });

  // A reply-count link lands on #replies; bring the replies into view once they've loaded.
  const ready = !post.isLoading && !replies.isLoading;
  useEffect(() => {
    if (!ready || window.location.hash !== "#replies") return;
    requestAnimationFrame(() => document.getElementById("replies")?.scrollIntoView({ block: "start" }));
  }, [ready]);

  const data = post.data;
  const play = data ? trackViewToPlayView(data.track) : undefined;
  const artist = play?.artists?.[0];
  const name = useDisplayActor(data?.author, data?.authorDid).name;
  const context = data?.listenContext;
  const isOwn = !!viewer && data?.authorDid === viewer;

  const remove = async () => {
    if (!agent?.did || !data || deleting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setNote(null);
    try {
      await agent.call("com.atproto.repo.deleteRecord", {}, socialPostDeleteParams(data.uri, agent.did, data.cid));
      forgetPost(client, data.uri, data.replyParentUri);
      back();
    } catch {
      setNote("The post wasn't deleted. Try again.");
      setDeleting(false);
    }
  };

  const share = async () => {
    if (!data) return;
    const result = await shareLink(`${data.text ? `${data.text} ` : ""}${play?.trackName ?? ""}`, absoluteUrl(postHrefFromUri(data.uri) ?? "/"));
    setNote(result === "copied" ? "Link copied." : result === "failed" ? "Couldn't share this post." : null);
  };

  if (post.isLoading) {
    return (
      <Screen back pageTitle="Post">
        <Loading />
      </Screen>
    );
  }
  if (post.isError || !data || !play) {
    return (
      <Screen back pageTitle="Post">
        <ErrorNotice title="This post didn't load" body="It may have been deleted, or teal couldn't be reached." onRetry={() => post.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen back pageTitle={data.text || play.trackName} width="wide">
      <div className="flex flex-col gap-5 nav:flex-row nav:items-start nav:gap-8">
        <div className="flex flex-col gap-4 nav:sticky nav:top-7 nav:w-[400px] nav:shrink-0">
          <AmbientSource uri={coverUri(play.releaseMbId)}>
            <Cover releaseMbId={play.releaseMbId} radius={18} label={`${play.releaseName ?? play.trackName} cover`} eager />
          </AmbientSource>
          <div className="flex flex-col gap-1">
            <Heading level={1} size="title" onBackdrop className="text-[26px] leading-[30px]">
              {play.trackName}
            </Heading>
            <p className="halo text-[17px] text-ink-2">
              {artist ? (
                <A href={musicArtistHref(artist.artistName, artist.artistMbId)} className="font-semibold text-ink hover:underline">
                  {artist.artistName}
                </A>
              ) : null}
              {play.releaseName ? ` · ${play.releaseName}` : ""}
            </p>
          </div>
          {play.originUri ? <LinkButton href={play.originUri} target="_blank" label="Listen" icon={ArrowUpRight} /> : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <Glass as="article" className="flex flex-col gap-3.5 p-4">
            <A href={`/profile/${data.authorDid}`} className="flex items-center gap-3 self-start hover:opacity-85">
              <Avatar did={data.authorDid} avatar={data.author?.avatar} name={name} size={44} />
              <span className="flex flex-col">
                <span className="font-semibold">{name}</span>
                {data.author?.handle ? <span className="text-[14px] text-ink-2">@{data.author.handle}</span> : null}
              </span>
            </A>
            {data.text ? <RichText text={data.text} facets={data.facets} className="text-[21px] leading-[28px] text-ink" /> : null}
            <p className="text-[14px] text-ink-2" suppressHydrationWarning>
              <time dateTime={data.createdAt}>{new Date(data.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
              {context?.authorPlayCount && context.authorPlayCount > 1 ? ` · ${name} has played this ${context.authorPlayCount} times` : ""}
            </p>
            {viewer || (data.reactions ?? []).length > 0 ? (
              <div className="border-t border-hair pt-3.5">
                <ReactionBar subject={{ uri: data.uri, cid: data.cid }} reactions={data.reactions ?? []} />
              </div>
            ) : null}
            <div className="flex items-center gap-2 border-t border-hair pt-3">
              <p aria-label={`${data.replyCount} ${data.replyCount === 1 ? "reply" : "replies"}`} className="flex flex-1 items-center gap-1.5 text-[14px] tabular-nums text-ink-2">
                <Icon icon={MessageCircle} size={20} className="text-ink-2" />
                {data.replyCount}
              </p>
              <IconButton icon={Share} label="Share" size={38} onClick={share} />
              {isOwn && !confirmDelete ? <IconButton ref={trashRef} icon={Trash2} label="Delete post" size={38} onClick={remove} /> : null}
            </div>
            {isOwn && confirmDelete ? (
              <div role="alert" className="flex flex-col gap-2 rounded-[14px] bg-fill p-3">
                <p className="font-semibold">Delete this post? This can't be undone.</p>
                <ButtonRow>
                  <Button ref={confirmRef} label={deleting ? "Deleting" : "Delete"} size="sm" variant="destructive" loading={deleting} onClick={remove} />
                  <Button label="Cancel" size="sm" variant="secondary" disabled={deleting} onClick={() => setConfirmDelete(false)} />
                </ButtonRow>
              </div>
            ) : null}
            {note ? (
              <p role="status" className="text-[14px] text-ink-2">
                {note}
              </p>
            ) : null}
          </Glass>

          {context && context.circleListenerCount > 0 ? (
            <Glass as="section" className="flex flex-col gap-2 p-4">
              <Heading level={2}>In your circle</Heading>
              <p className="text-[15px] text-ink-2">
                {context.circleListenerCount} {context.circleListenerCount === 1 ? "person you follow has" : "people you follow have"} played this today.
              </p>
              {context.circleSample.map((p) => (
                <A key={p.did} href={`/profile/${p.did}`} className="flex items-center gap-3 py-1.5 hover:opacity-85">
                  <Avatar did={p.did} avatar={p.avatar} name={displayActorName(p, p.did)} size={40} />
                  <span className="font-semibold">{displayActorName(p, p.did)}</span>
                </A>
              ))}
            </Glass>
          ) : null}

          <Glass as="section" id="replies" aria-labelledby="replies-title" className="scroll-mt-6 p-4">
            <Heading level={2} id="replies-title" className="mb-1">
              Replies
            </Heading>
            {replies.isLoading ? (
              <Loading className="py-4" />
            ) : replies.isError ? (
              <div className="flex flex-col items-start gap-2 py-2">
                <p className="text-[15px] text-ink-2">Replies didn't load.</p>
                <Button label="Try again" variant="secondary" size="sm" onClick={() => replies.refetch()} />
              </div>
            ) : !replies.data?.length ? (
              <p className="py-2 text-[15px] text-ink-2">No replies yet. Start the conversation.</p>
            ) : (
              <ul>
                {replies.data.map((reply, i) => (
                  <Reply key={reply.uri} reply={reply} last={i === replies.data!.length - 1} />
                ))}
              </ul>
            )}
            <div className="mt-3 border-t border-hair pt-3">
              <Composer track={play} replyTo={data} onPublished={(reply) => rememberPost(client, reply.authorDid, reply)} />
            </div>
          </Glass>
        </div>
      </div>
    </Screen>
  );
}
