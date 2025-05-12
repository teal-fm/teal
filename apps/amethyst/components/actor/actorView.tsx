import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Text } from "@/components/ui/text";
import { useStore } from "@/stores/mainStore";
import { Image, View } from "react-native";
import { CardTitle } from "../../components/ui/card";

import ActorPlaysView from "@/components/play/actorPlaysView";
import { Button } from "@/components/ui/button";
import { Icon } from "@/lib/icons/iconWithClassName";
import { Agent } from "@atproto/api";
import { MoreHorizontal, Pen, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import EditProfileModal from "./editProfileView";

import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import { OutputSchema as GetProfileOutputSchema } from "@teal/lexicons/src/types/fm/teal/alpha/actor/getProfile";
import { Record as ProfileRecord } from "@teal/lexicons/src/types/fm/teal/alpha/actor/profile";

const topAlbums = [
  {
    name: "Album 1",
    artist: "Artist 1",
    image:
      "https://at.uwu.wang/did:plc:tas6hj2xjrqben5653v5kohk/bafkreihxjfnq7r6tst33pf34lh6tojeh6tw6kt3p23dmhxmb2klxckjxx4",
  },
  {
    name: "Album 2",
    artist: "Artist 2",
    image:
      "https://at.uwu.wang/did:plc:tas6hj2xjrqben5653v5kohk/bafkreihxjfnq7r6tst33pf34lh6tojeh6tw6kt3p23dmhxmb2klxckjxx4",
  },
  {
    name: "Album 3",
    artist: "Artist 3",
    image:
      "https://at.uwu.wang/did:plc:tas6hj2xjrqben5653v5kohk/bafkreihxjfnq7r6tst33pf34lh6tojeh6tw6kt3p23dmhxmb2klxckjxx4",
  },
  {
    name: "Album 4",
    artist: "Artist 4",
    image:
      "https://at.uwu.wang/did:plc:tas6hj2xjrqben5653v5kohk/bafkreihxjfnq7r6tst33pf34lh6tojeh6tw6kt3p23dmhxmb2klxckjxx4",
  },
  {
    name: "Album 5",
    artist: "Artist 5",
    image:
      "https://at.uwu.wang/did:plc:tas6hj2xjrqben5653v5kohk/bafkreihxjfnq7r6tst33pf34lh6tojeh6tw6kt3p23dmhxmb2klxckjxx4",
  },
];

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
          "fm.teal.alpha.actor.getProfile",
          { actor: actorDid },
          {},
          { headers: { "atproto-proxy": tealDid + "#teal_fm_appview" } }
        );
        if (isMounted) {
          setProfile(res.data["actor"] as GetProfileOutputSchema["actor"]);
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
    newAvatarUri: string,
    newBannerUri: string
  ) => {
    if (!pdsAgent) {
      return;
    }
    // Implement your save logic here (e.g., update your database or state)
    console.log("Saving profile:", updatedProfile, newAvatarUri, newBannerUri);

    // Update the local profile data
    setProfile((prevProfile) => ({
      ...prevProfile,
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarUri,
      banner: newBannerUri,
    }));

    // get the current user's profile (getRecord)
    let currentUser: ProfileRecord | undefined;
    let cid: string | undefined;
    try {
      const res = await pdsAgent.call("com.atproto.repo.getRecord", {
        repo: pdsAgent.did,
        collection: "fm.teal.alpha.actor.profile",
        rkey: "self",
      });
      currentUser = res.data.value;
      cid = res.data.cid;
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }

    // upload blobs if necessary
    let newAvatarBlob = currentUser?.avatar ?? undefined;
    let newBannerBlob = currentUser?.banner ?? undefined;
    if (newAvatarUri) {
      // if it is http/s url then do nothing
      if (!newAvatarUri.startsWith("http")) {
        console.log("Uploading avatar");
        // its a b64 encoded data uri, decode it and get a blob
        const data = await fetch(newAvatarUri).then((r) => r.blob());
        const fileType = newAvatarUri.split(";")[0].split(":")[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newAvatarBlob = (await pdsAgent.uploadBlob(blob)).data.blob;
      }
    }
    if (newBannerUri) {
      if (!newBannerUri.startsWith("http")) {
        console.log("Uploading banner");
        const data = await fetch(newBannerUri).then((r) => r.blob());
        const fileType = newBannerUri.split(";")[0].split(":")[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newBannerBlob = (await pdsAgent.uploadBlob(blob)).data.blob;
      }
    }

    console.log("done uploading");

    let record: ProfileRecord = {
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarBlob,
      banner: newBannerBlob,
    };

    let post;

    if (cid) {
      post = await pdsAgent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.actor.profile",
          rkey: "self",
          record,
          swapRecord: cid,
        }
      );
    } else {
      post = await pdsAgent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: pdsAgent.did,
          collection: "fm.teal.alpha.actor.profile",
          rkey: "self",
          record,
        }
      );
    }

    setIsEditing(false); // Close the modal after saving
  };

  if (!profile) {
    return null;
  }

  return (
    <>
      {profile.banner ? (
        <Image
          className="w-full max-w-[100vh] h-32 md:h-44 scale-[1.32] rounded-xl -mb-6"
          source={{
            uri:
              getImageCdnLink({ did: profile.did!, hash: profile.banner }) ??
              GITHUB_AVATAR_URI,
          }}
        />
      ) : (
        <View className="w-full max-w-[100vh] h-32 md:h-44 scale-[1.32] rounded-xl -mb-6 bg-background" />
      )}
      <View className="flex flex-col items-left justify-start text-left max-w-2xl w-screen gap-1 p-4 px-8">
        <View className="flex flex-row justify-between items-center">
          <View className="flex justify-between">
            <View className="group">
              <Avatar alt="Rick Sanchez's Avatar" className="w-24 h-24">
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
              <View>
                {topAlbums.map((album, i: number) => (
                  <View
                    key={album.name}
                    className={`absolute  ${
                      i === 0
                        ? // #1, middle, yellow border
                          `-z-10 group-hover:-translate-y-[9.3rem] group-hover:translate-x-5 group-hover:rotate-0 group-hover:bg-yellow-200 group-hover:p-[0.125rem]`
                        : i === 1
                          ? // #2, left of #1, silver border
                            `-z-[11] group-hover:-translate-y-[8.8rem] group-hover:-translate-x-2 group-hover:-rotate-12 group-hover:bg-stone-200 group-hover:p-[0.125rem]`
                          : i === 2
                            ? // #3, right of #1, brown border
                              `-z-[11] group-hover:-translate-y-[8.8rem] group-hover:translate-x-[3.25rem] group-hover:rotate-12 group-hover:bg-yellow-900 group-hover:p-[0.125rem]`
                            : i === 3
                              ? // #4, very left
                                `-z-[12] group-hover:-translate-x-8 group-hover:-translate-y-[7.5rem] group-hover:-rotate-45`
                              : // #5, very right
                                `-z-[12] group-hover:-translate-y-[7.5rem] group-hover:translate-x-[5.5rem] group-hover:rotate-45`
                    } -translate-y-[5.6rem] translate-x-5 rotate-0 rounded-xl opacity-0 transition-all duration-300 group-hover:opacity-100`}
                  >
                    {album.image ? (
                      <Image
                        source={{
                          uri: album.image,
                          width: 50,
                          height: 50,
                        }}
                        alt={`${album.name} by ${album.artist}`}
                        className="rounded-xl"
                      />
                    ) : (
                      <Text>XD</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
            <CardTitle className="text-left flex w-full justify-between mt-2">
              {profile.displayName ?? " Richard"}
            </CardTitle>
          </View>
          <View className="mt-2 flex-row gap-2">
            {isSelf ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-row gap-2 justify-center items-center"
                onPress={() => setIsEditing(true)}
              >
                <Icon icon={Pen} size={18} />
                <Text>Edit</Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-row gap-2 justify-center items-center"
              >
                <Icon icon={Plus} size={18} />
                <Text>Follow</Text>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-white aspect-square p-0 rounded-full flex flex-row gap-2 justify-center items-center"
            >
              <Icon icon={MoreHorizontal} size={18} />
            </Button>
          </View>
        </View>
        <View>
          {profile
            ? profile.description?.split("\n").map((str, i) => (
                <Text
                  className="text-start self-start place-self-start"
                  key={i}
                >
                  {str}
                </Text>
              )) || <Text>'A very mysterious person'</Text>
            : "Loading..."}
        </View>
      </View>
      <View className="max-w-2xl w-full gap-4 py-4 pl-8">
        <Text className="text-left text-2xl border-b border-b-muted-foreground/30 -ml-2 pl-2 mr-6">
          Stamps
        </Text>
        <ActorPlaysView repo={actorDid} pdsAgent={pdsAgent} />
      </View>
      {isSelf && (
        <EditProfileModal
          isVisible={isEditing}
          onClose={() => setIsEditing(false)}
          profile={profile} // Pass the profile data
          onSave={handleSave} // Pass the save handler
        />
      )}
    </>
  );
}
