import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link, router } from "expo-router";
import { Pencil, Settings, UserMinus, UserPlus } from "lucide-react-native";
import { normalizeHandle } from "@/lib/teal/actors";
import type { GraphSummaryView } from "@/lib/teal/api";
import { useViewerDid } from "@/lib/teal/queries";
import { Avatar, Button, ButtonRow, Glass, Heading, IconButton, Text, useLayout } from "@/next/components/ds";
import RichText from "@/next/components/post/RichText";
import { useToggleFollow, type DisplayProfile } from "@/next/hooks/useProfile";

import { Fingerprint } from "./Fingerprint";

const LONG_BIO = 180;

function FollowButton({ did, graph }: { did: string; graph?: GraphSummaryView }) {
  const viewer = useViewerDid();
  const toggle = useToggleFollow(did);
  const following = graph?.viewerFollowing;
  return (
    <View className="gap-1">
      <Button
        label={toggle.isPending ? "Saving" : following ? "Following" : "Follow"}
        icon={following ? UserMinus : UserPlus}
        variant={following ? "secondary" : "primary"}
        size="sm"
        loading={toggle.isPending}
        accessibilityLabel={following ? "Unfollow" : "Follow"}
        onPress={() => (viewer ? toggle.mutate(following) : router.push("/auth/login"))}
      />
      {toggle.isError ? (
        <Text role="alert" className="text-[13px] text-destructive">
          That didn't go through. Try again.
        </Text>
      ) : null}
    </View>
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
  const layout = useLayout();
  const [bioOpen, setBioOpen] = useState(false);
  const handle = normalizeHandle(profile?.handle);
  const name = profile?.displayName || handle || "Listener";
  const bio = profile?.description || "";
  const longBio = bio.length > LONG_BIO || bio.split("\n").length > 3;

  return (
    <View>
      <View className="-mx-4 md:-mx-6">
        <Fingerprint actor={did} height={layout.sidebar ? 200 : 168} />
      </View>
      {/* The avatar overlaps the panel's top edge, so it sits outside the clipped Glass. */}
      <View className="-mt-9">
        <Glass strong className="gap-2 p-4 pt-[64px]">
          <Heading level={1} size="hero" numberOfLines={2}>
            {name}
          </Heading>
          {handle ? <Text className="-mt-1 text-[15px] text-ink-2">@{handle}</Text> : null}
          {bio ? (
            <View>
              {bioOpen || !longBio ? (
                <RichText text={bio} facets={profile?.descriptionFacets} className="text-[16px] leading-[22px] text-ink" />
              ) : (
                <Text numberOfLines={3} className="leading-[22px]">
                  {bio}
                </Text>
              )}
              {longBio ? (
                <Pressable
                  accessibilityRole="button"
                  aria-expanded={bioOpen}
                  onPress={() => setBioOpen((open) => !open)}
                  className="min-h-10 justify-center self-start"
                >
                  <Text className="text-[15px] font-semibold text-tint">{bioOpen ? "Show less" : "Read more"}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View className="flex-row flex-wrap gap-x-4">
            {(["followers", "following"] as const).map((kind) => {
              const count = kind === "followers" ? graph?.followersCount : graph?.followsCount;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  aria-expanded={people === kind}
                  onPress={() => onPeople(kind)}
                  className="min-h-10 justify-center"
                >
                  <Text className="text-[15px] text-ink-2">
                    <Text className="font-semibold tabular-nums text-ink">{count ?? 0}</Text> {kind}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <ButtonRow>
            {isSelf ? (
              <>
                <Button label="Edit profile" icon={Pencil} size="sm" variant="secondary" onPress={onEdit} />
                <Link href="/settings" asChild>
                  <IconButton icon={Settings} label="Settings" size={36} />
                </Link>
              </>
            ) : (
              <FollowButton did={did} graph={graph} />
            )}
          </ButtonRow>
        </Glass>
        <View className="absolute -top-[52px] left-4">
          <Avatar did={did} avatar={profile?.avatar} name={name} size={104} listeningNow={listeningNow} />
        </View>
      </View>
    </View>
  );
}
