import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import ActorPlaysView from "@/components/play/actorPlaysView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { getBlobHash } from "@/lib/atp/onboardingRecords";
import { saveProfileRecord } from "@/lib/atp/profileRecord";
import { Icon } from "@/lib/icons/iconWithClassName";
import type { SelectedProfileImage } from "@/lib/profileImage";
import { useStore } from "@/stores/mainStore";
import { Agent } from "@atproto/api";
import { MoreHorizontal, Pen, Plus } from "lucide-react-native";

import { OutputSchema as GetProfileOutputSchema } from "@teal/lexicons/src/types/fm/teal/actor/getProfile";

import { CardTitle } from "../../components/ui/card";
import EditProfileModal from "./editProfileView";

const GITHUB_AVATAR_URI =
  "https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg";

export interface ActorViewProps {
  actorDid: string;
  pdsAgent: Agent | null;
}

export default function ActorView({ actorDid, pdsAgent }: ActorViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<
    GetProfileOutputSchema["actor"] | null
  >(null);

  const tealDid = useStore((state) => state.tealDid);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      if (!pdsAgent) {
        return;
      }
      try {
        let res = await pdsAgent.call(
          "fm.teal.actor.getProfile",
          { actor: actorDid },
          {},
          { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } },
        );
        if (isMounted) {
          setProfile(res.data.actor as GetProfileOutputSchema["actor"]);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [pdsAgent, actorDid, tealDid]);

  const isSelf = actorDid === (pdsAgent?.did || "");

  const handleSave = async (
    updatedProfile: { displayName: any; description: any },
    selectedAvatar?: SelectedProfileImage,
    selectedBanner?: SelectedProfileImage,
  ) => {
    if (!pdsAgent) {
      return;
    }
    const record = await saveProfileRecord(pdsAgent, {
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: selectedAvatar,
      banner: selectedBanner,
    });

    setProfile(
      (previous) =>
        previous && {
          ...previous,
          displayName: updatedProfile.displayName,
          description: updatedProfile.description,
          avatar: getBlobHash(record.avatar),
          banner: getBlobHash(record.banner),
        },
    );
    setIsEditing(false);
  };

  if (!profile) {
    return null;
  }

  return (
    <>
      {profile.banner ? (
        <Image
          className="-mb-6 h-32 w-full max-w-[100vh] scale-[1.32] rounded-xl md:h-44"
          source={{
            uri:
              getImageCdnLink({ did: profile.did!, hash: profile.banner }) ??
              GITHUB_AVATAR_URI,
          }}
        />
      ) : (
        <View className="-mb-6 h-32 w-full max-w-[100vh] scale-[1.32] rounded-xl bg-background md:h-44" />
      )}
      <View className="items-left flex w-screen max-w-2xl flex-col justify-start gap-1 p-4 px-8 text-left">
        <View className="flex flex-row items-center justify-between">
          <View className="flex justify-between">
            <Avatar alt="Rick Sanchez's Avatar" className="h-24 w-24">
              <AvatarImage
                source={{
                  uri:
                    (profile.avatar &&
                      getImageCdnLink({
                        did: profile.did!,
                        hash: profile.avatar,
                      })) ||
                    GITHUB_AVATAR_URI,
                }}
              />
              <AvatarFallback>
                <Text>{profile.displayName?.substring(0, 1) ?? "R"}</Text>
              </AvatarFallback>
            </Avatar>
            <CardTitle className="mt-2 flex w-full justify-between text-left">
              {profile.displayName ?? " Richard"}
            </CardTitle>
          </View>
          <View className="mt-2 flex-row gap-2">
            {isSelf ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-row items-center justify-center gap-2 rounded-xl"
                onPress={() => setIsEditing(true)}
              >
                <Icon icon={Pen} size={18} />
                <Text>Edit</Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-row items-center justify-center gap-2 rounded-xl"
              >
                <Icon icon={Plus} size={18} />
                <Text>Follow</Text>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex aspect-square flex-row items-center justify-center gap-2 rounded-full p-0 text-white"
            >
              <Icon icon={MoreHorizontal} size={18} />
            </Button>
          </View>
        </View>
        <View>
          {profile
            ? profile.description?.split("\n").map((str, i) => (
                <Text
                  className="place-self-start self-start text-start"
                  key={i}
                >
                  {str}
                </Text>
              )) || <Text>'A very mysterious person'</Text>
            : "Loading..."}
        </View>
      </View>
      <View className="w-full max-w-2xl gap-4 py-4 pl-8">
        <Text className="-ml-2 mr-6 border-b border-b-muted-foreground/30 pl-2 text-left text-2xl">
          Stamps
        </Text>
        <ActorPlaysView repo={actorDid} pdsAgent={pdsAgent} />
      </View>
      {isSelf && isEditing && (
        <EditProfileModal
          onClose={() => setIsEditing(false)}
          profile={profile} // Pass the profile data
          onSave={handleSave} // Pass the save handler
        />
      )}
    </>
  );
}
