import { useState } from "react";
import { Pencil, Settings, UserMinus, UserPlus } from "lucide-react";
import { useToggleFollow, type DisplayProfile } from "@teal/client/hooks/useProfile";
import { normalizeHandle } from "@teal/client/teal/actors";
import type { GraphSummaryView } from "@teal/client/teal/api";
import { useViewerDid } from "@teal/client/teal/queries";
import { Avatar, Button, ButtonRow, Glass, Heading, IconLink, useGo } from "~/ds";
import { RichText } from "~/components/post/RichText";

import { Fingerprint } from "./Fingerprint";

const LONG_BIO = 180;

function FollowButton({ did, graph }: { did: string; graph?: GraphSummaryView }) {
  const viewer = useViewerDid();
  const go = useGo();
  const toggle = useToggleFollow(did);
  const following = graph?.viewerFollowing;
  return (
    <div className="flex flex-col gap-1">
      <Button
        label={toggle.isPending ? "Saving" : following ? "Following" : "Follow"}
        icon={following ? UserMinus : UserPlus}
        variant={following ? "secondary" : "primary"}
        size="sm"
        loading={toggle.isPending}
        aria-pressed={!!following}
        onClick={() => (viewer ? toggle.mutate(following) : void go("/auth/login"))}
      />
      {toggle.isError ? (
        <p role="alert" className="text-[13px] text-destructive">
          That didn't go through. Try again.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The top of a profile: the listening fingerprint, then a glass panel with the
 * avatar overlapping its edge, name, bio, follow counts, and actions.
 */
export function ProfileHeader({
  did,
  profile,
  graph,
  isSelf,
  listeningNow,
  people,
  onPeople,
  onEdit,
}: {
  did: string;
  profile?: DisplayProfile;
  graph?: GraphSummaryView;
  isSelf: boolean;
  listeningNow: boolean;
  people: "followers" | "following" | null;
  onPeople: (kind: "followers" | "following") => void;
  onEdit: () => void;
}) {
  const [bioOpen, setBioOpen] = useState(false);
  const handle = normalizeHandle(profile?.handle);
  const name = profile?.displayName || handle || did;
  const bio = profile?.description || "";
  const longBio = bio.length > LONG_BIO || bio.split("\n").length > 3;

  return (
    <header>
      <div className="-mx-4 md:-mx-6">
        <div className="h-[168px] nav:h-[200px]">
          <Fingerprint actor={did} />
        </div>
      </div>
      {/* The avatar overlaps the panel's top edge, so it sits outside the clipped glass. */}
      <div className="relative -mt-9">
        <Glass strong className="flex flex-col gap-2 p-4 pt-[64px]">
          <Heading level={1} size="hero" className="line-clamp-2 break-words">
            {name}
          </Heading>
          {handle ? <p className="-mt-1 text-[15px] text-ink-2">@{handle}</p> : null}
          {bio ? (
            <div>
              {bioOpen || !longBio ? (
                <RichText text={bio} facets={profile?.descriptionFacets} className="text-[16px] leading-[22px] text-ink" />
              ) : (
                <p className="line-clamp-3 leading-[22px] whitespace-pre-wrap">{bio}</p>
              )}
              {longBio ? (
                <button
                  type="button"
                  aria-expanded={bioOpen}
                  onClick={() => setBioOpen((open) => !open)}
                  className="min-h-10 text-[15px] font-semibold text-tint hover:underline"
                >
                  {bioOpen ? "Show less" : "Read more"}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-4">
            {(["followers", "following"] as const).map((kind) => {
              const count = kind === "followers" ? graph?.followersCount : graph?.followsCount;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-expanded={people === kind}
                  onClick={() => onPeople(kind)}
                  className="min-h-10 text-[15px] text-ink-2 hover:underline"
                >
                  <span className="font-semibold tabular-nums text-ink">{count ?? 0}</span>{" "}
                  {kind === "followers" ? (count === 1 ? "follower" : "followers") : "following"}
                </button>
              );
            })}
          </div>
          <ButtonRow>
            {isSelf ? (
              <>
                <Button label="Edit profile" icon={Pencil} size="sm" variant="secondary" onClick={onEdit} />
                <IconLink href="/settings" icon={Settings} label="Settings" size={36} />
              </>
            ) : (
              <FollowButton did={did} graph={graph} />
            )}
          </ButtonRow>
        </Glass>
        <div className="absolute -top-[52px] left-4">
          <Avatar did={did} avatar={profile?.avatar} name={name} size={104} listeningNow={listeningNow} />
        </div>
      </div>
    </header>
  );
}
