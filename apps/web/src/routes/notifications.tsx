import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Heart, MessageCircle, Repeat2, SmilePlus, UserPlus, type LucideIcon } from "lucide-react";
import { actorAvatarUrl, actorProfileHref, displayActorName } from "@teal/client/teal/actors";
import { displayArtists, getNotifications, getSocialPost, XrpcError, type SocialNotificationView } from "@teal/client/teal/api";
import { useViewerDid } from "@teal/client/teal/queries";
import { hrefFromAtUri, postHrefFromUri } from "@teal/client/teal/routes";
import { trackViewToPlayView } from "@teal/client/teal/social";
import { shortAgo } from "@teal/client/teal/today";
import { cn } from "@teal/client/utils";
import { A, Avatar, Button, Cover, ErrorNotice, Glass, Icon, LinkButton, Loading, Notice, Screen } from "~/ds";
import { useEndReached } from "~/hooks/useEndReached";
import { useAuth } from "~/lib/auth";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Activity · Teal" }] }),
  component: Activity,
});

const REASONS: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  like: { label: "liked your", icon: Heart, tone: "text-rose-500" },
  repost: { label: "reposted your", icon: Repeat2, tone: "text-tint" },
  reply: { label: "replied to your post", icon: MessageCircle, tone: "text-tint" },
  reaction: { label: "reacted to your", icon: SmilePlus, tone: "text-tint" },
  follow: { label: "followed you", icon: UserPlus, tone: "text-tint" },
  badgeAssignment: { label: "gave you a badge", icon: Bell, tone: "text-ink-2" },
};
const OTHER = { label: "interacted with your profile", icon: Bell, tone: "text-ink-2" };

function targetKind(uri?: string) {
  if (uri?.includes(".feed.play/")) return "listen";
  if (uri?.includes(".social.playlist/")) return "playlist";
  return "post";
}

type Group = { key: string; reason: string; items: SocialNotificationView[]; contextUri?: string };

/** Likes, reposts, replies, and reactions on the same post fold into one row. */
function group(items: SocialNotificationView[]) {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const contextUri = item.reason === "reply" ? item.recordUri : item.subjectUri;
    const groupable = contextUri && ["like", "repost", "reply", "reaction"].includes(item.reason);
    const key = groupable ? `${item.reason}:${contextUri}` : `n:${item.id}`;
    const existing = groups.get(key);
    if (existing) existing.items.push(item);
    else groups.set(key, { key, reason: item.reason, items: [item], contextUri: groupable ? contextUri : undefined });
  }
  return [...groups.values()];
}

/** Activity: who liked, replied, reacted, and followed. */
function Activity() {
  const viewer = useViewerDid();
  const status = useAuth((state) => state.status);
  const feed = useInfiniteQuery({
    queryKey: ["notifications", viewer],
    queryFn: ({ pageParam }) => getNotifications(viewer!, 30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.cursor,
    enabled: !!viewer,
  });
  const groups = useMemo(() => group(feed.data?.pages.flatMap((p) => p.items) ?? []), [feed.data]);
  const more = useEndReached(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, !!feed.hasNextPage);

  if (!viewer) {
    return (
      <Screen title="Activity">
        {status === "start" ? (
          <Loading />
        ) : (
          <Notice
            center
            icon={Bell}
            title="Sign in to see your activity"
            body="Replies, likes, reactions, and new followers show up here."
            action={<LinkButton href="/auth/login" label="Sign in" />}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Activity">
      {feed.isLoading ? (
        <Loading />
      ) : feed.isError ? (
        <ErrorNotice title="Your activity didn't load" onRetry={() => feed.refetch()} />
      ) : groups.length === 0 ? (
        <Notice title="Nothing yet" body="When people reply, like, react, or follow you, it shows up here." />
      ) : (
        <Glass as="section" aria-label="Notifications" className="px-4">
          <ul>
            {groups.map((g, i) => (
              <ActivityRow key={g.key} group={g} last={i === groups.length - 1} />
            ))}
          </ul>
        </Glass>
      )}
      <div ref={more} />
      {feed.isFetchingNextPage ? <Loading className="py-6" /> : null}
    </Screen>
  );
}

function ActivityRow({ group: g, last }: { group: Group; last: boolean }) {
  const known = REASONS[g.reason] ?? OTHER;
  // Likes, reposts, and reactions can land on a listen or a playlist as well as a post.
  const target = targetKind(g.contextUri);
  const reason = known.label.endsWith(" your") ? { ...known, label: `${known.label} ${target}` } : known;
  const first = g.items[0];
  const others = g.items.length - 1;
  const href = g.contextUri ? postHrefFromUri(g.contextUri) : undefined;
  // Reactions on a listen point at the listen rather than a post.
  const otherHref = !href && g.contextUri ? hrefFromAtUri(g.contextUri) : undefined;

  return (
    <li className={cn("py-4", !last && "border-b border-hair")}>
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill">
          <Icon icon={reason.icon} size={19} className={reason.tone} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex">
            {g.items.slice(0, 4).map((item, index) => {
              const did = item.actor?.did || item.actorDid;
              const name = displayActorName(item.actor, did);
              return (
                <A
                  key={item.id}
                  href={`/profile/${actorProfileHref(item.actor, did)}`}
                  aria-label={`${name}'s profile`}
                  className="relative"
                  style={{ marginLeft: index ? -8 : 0, zIndex: 4 - index }}
                >
                  <Avatar did={did} avatar={actorAvatarUrl(item.actor, did)} name={name} size={36} className="ring-2 ring-ground" />
                </A>
              );
            })}
          </div>
          <p className="text-[15px] leading-[21px]">
            <span className="font-semibold">{displayActorName(first.actor, first.actor?.did || first.actorDid)}</span>
            {others > 0 ? ` and ${others} ${others === 1 ? "other" : "others"}` : ""} {reason.label}
            <span className="text-ink-2" suppressHydrationWarning>
              {" "}
              · {shortAgo(first.createdAt)}
            </span>
          </p>
          {href && g.contextUri ? <PostPreview uri={g.contextUri} href={href} /> : null}
          {otherHref ? (
            <A href={otherHref} className="self-start text-[14px] font-semibold text-tint hover:underline">
              Open your {target}
            </A>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function PostPreview({ uri, href }: { uri: string; href: string }) {
  const post = useQuery({
    queryKey: ["post", uri, null],
    queryFn: () => getSocialPost(uri).then((r) => r.post),
    retry: (count, error) => !(error instanceof XrpcError && error.status === 404) && count < 2,
  });
  if (post.isLoading) return <div className="h-16 rounded-[16px] bg-fill" />;
  if (post.isError || !post.data) {
    const gone = post.error instanceof XrpcError && post.error.status === 404;
    return gone ? (
      <p className="text-[14px] text-ink-2">The original post is no longer available.</p>
    ) : (
      <div className="flex items-center gap-3">
        <p className="text-[14px] text-ink-2">This post didn't load.</p>
        <Button label="Try again" variant="secondary" size="sm" onClick={() => post.refetch()} />
      </div>
    );
  }
  const play = trackViewToPlayView(post.data.track);
  return (
    <A href={href} aria-label="Open the post" className="flex items-center gap-3 rounded-[16px] bg-fill p-2.5 hover:opacity-85">
      <Cover releaseMbId={play.releaseMbId} size={44} radius={8} ambient />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-[15px] text-ink">{post.data.text || play.trackName}</span>
        <span className="truncate text-[13px] text-ink-2">
          {play.trackName} · {displayArtists(play) || "Unknown artist"}
        </span>
      </span>
    </A>
  );
}
