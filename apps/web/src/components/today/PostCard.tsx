import { useState } from "react";
import { ArrowUpRight, MessageCircle, Share } from "lucide-react";
import { useDisplayActor } from "@teal/client/hooks/useDisplayActor";
import type { SocialPostView } from "@teal/client/teal/api";
import { absoluteUrl, musicArtistHref, postHrefFromUri } from "@teal/client/teal/routes";
import { trackViewToPlayView } from "@teal/client/teal/social";
import { shortAgo } from "@teal/client/teal/today";
import { A, AmbientSource, Avatar, Cover, coverUri, Glass, Icon } from "~/ds";
import { RichText } from "~/components/post/RichText";

import { ReactionBar } from "./ReactionBar";
import { shareLink } from "./share";

function contextLine(post: SocialPostView) {
  const c = post.listenContext;
  if (!c) return undefined;
  if (c.circleListenerCount > 0) {
    const named = c.circleSample.map((p) => p.displayName || p.handle).filter(Boolean).slice(0, 2);
    const others = c.circleListenerCount - named.length;
    const who = others > 0 ? `${named.join(", ")} and ${others} other${others === 1 ? "" : "s"}` : named.join(" and ");
    return `${who || `${c.circleListenerCount} people you follow`} played this today`;
  }
  if (c.viewerPlayCount) return `You've played this ${c.viewerPlayCount} time${c.viewerPlayCount === 1 ? "" : "s"}`;
  if (c.authorPlayCount && c.authorPlayCount > 1) return `${c.authorPlayCount} plays from ${post.author?.displayName || "them"}`;
  return undefined;
}

/** A song post: what someone said, the song beside it, and how your circle met it. */
export function PostCard({ post }: { post: SocialPostView }) {
  const play = trackViewToPlayView(post.track);
  const author = useDisplayActor(post.author, post.authorDid);
  const name = author.name;
  const href = postHrefFromUri(post.uri) ?? `/at:/${post.uri.replace(/^at:\/\//, "")}`;
  const artist = play.artists?.[0]?.artistName;
  const context = contextLine(post);
  const faces = post.listenContext?.circleSample ?? [];
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const result = await shareLink(`${post.text ? `${post.text} ` : ""}${play.trackName}`, absoluteUrl(href));
    if (result !== "copied") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AmbientSource uri={coverUri(play.releaseMbId)}>
      <Glass as="article" className="mb-3.5 flex flex-col gap-3 px-4 pt-4 pb-3">
        <header className="flex items-center gap-2.5">
          <A href={author.href} aria-label={name ? `${name}'s profile` : "Profile"}>
            <Avatar did={author.did} avatar={author.avatar} name={name} size={40} />
          </A>
          <A href={author.href} className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink hover:underline">
            {name}
            {author.handle && author.handle !== name ? <span className="text-sm font-normal text-ink-2"> @{author.handle}</span> : null}
          </A>
          <A href={href} className="text-sm text-ink-2 hover:underline">
            <time dateTime={post.createdAt} suppressHydrationWarning>
              {shortAgo(post.createdAt)}
            </time>
          </A>
        </header>

        {post.text ? (
          <RichText text={post.text} facets={post.facets} className="text-[20px] leading-[26px] font-medium tracking-tight text-ink" />
        ) : null}

        <div className="flex items-center gap-3.5">
          <A href={href} aria-label={`${play.trackName}${artist ? ` by ${artist}` : ""}`} className="shrink-0">
            <Cover releaseMbId={play.releaseMbId} size={112} radius={14} className="shadow-xl" />
          </A>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <A href={href} className="truncate text-[17px] font-semibold text-ink hover:underline">
              {play.trackName}
            </A>
            {artist ? (
              <A href={musicArtistHref(artist, play.artists?.[0]?.artistMbId)} className="truncate text-[15px] text-ink-2 hover:underline">
                {[artist, play.releaseName].filter(Boolean).join(" · ")}
              </A>
            ) : null}
            {context ? (
              <div className="mt-2 flex items-center gap-2">
                {faces.length > 0 ? (
                  <div className="flex">
                    {faces.map((p, i) => (
                      <span key={p.did} style={{ marginLeft: i ? -7 : 0 }}>
                        <Avatar did={p.did} avatar={p.avatar} name={p.displayName ?? p.handle} size={22} />
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="line-clamp-2 flex-1 text-[13px] text-ink-2">{context}</p>
              </div>
            ) : null}
          </div>
          {play.originUri ? (
            <a
              href={play.originUri}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in your music app"
              className="flex size-9 shrink-0 items-center justify-center self-start rounded-full bg-fill hover:brightness-95"
            >
              <Icon icon={ArrowUpRight} size={17} className="text-ink" />
            </a>
          ) : null}
        </div>

        <footer className="flex items-center">
          <div className="flex-1">
            <ReactionBar subject={{ uri: post.uri, cid: post.cid }} reactions={post.reactions ?? []} />
          </div>
          <A
            href={`${href}#replies`}
            aria-label={`${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}`}
            className="flex h-9 items-center gap-1.5 px-2 text-sm tabular-nums text-ink-2 hover:text-ink"
          >
            <Icon icon={MessageCircle} size={20} className="text-current" />
            {post.replyCount || ""}
          </A>
          <button
            type="button"
            aria-label={copied ? "Link copied" : "Share"}
            onClick={share}
            className="flex h-9 min-w-9 items-center justify-center gap-1 px-1 text-sm text-ink-2 hover:text-ink"
          >
            <Icon icon={Share} size={20} className="text-current" />
            {copied ? <span aria-live="polite">Copied</span> : null}
          </button>
        </footer>
      </Glass>
    </AmbientSource>
  );
}
