import { ScrollView, View, Image } from 'react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CardTitle } from '../../components/ui/card';
import { Text } from '@/components/ui/text';
import { useStore } from '@/stores/mainStore';

import ActorPlaysView from '@/components/play/actorPlaysView';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icons/iconWithClassName';
import { MoreHorizontal, Pen, Plus } from 'lucide-react-native';
import { Agent } from '@atproto/api';
import { useState, useEffect } from 'react';
import EditProfileModal from './editProfileView';

import { Record as ProfileRecord } from '@teal/lexicons/src/types/fm/teal/alpha/actor/profile';
import { OutputSchema as GetProfileOutputSchema } from '@teal/lexicons/src/types/fm/teal/alpha/actor/getProfile';
import getImageCdnLink from '@/lib/atp/getImageCdnLink';

const GITHUB_AVATAR_URI =
  'https://i.pinimg.com/originals/ef/a2/8d/efa28d18a04e7fa40ed49eeb0ab660db.jpg';

export interface ActorViewProps {
  actorDid: string;
  pdsAgent: Agent;
}

export default function ActorView({ actorDid, pdsAgent }: ActorViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<
    GetProfileOutputSchema['actor'] | null
  >(null);

  const tealDid = useStore((state) => state.tealDid);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        let res = await pdsAgent.call(
          'fm.teal.alpha.actor.getProfile',
          { actor: actorDid },
          {},
          { headers: { 'atproto-proxy': tealDid + '#teal_fm_appview' } },
        );
        if (isMounted) {
          setProfile(res.data['actor'] as GetProfileOutputSchema['actor']);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [pdsAgent, actorDid, tealDid]);

  const isSelf = actorDid === pdsAgent.did;

  const handleSave = async (
    updatedProfile: { displayName: any; description: any },
    newAvatarUri: string,
    newBannerUri: string,
  ) => {
    // Implement your save logic here (e.g., update your database or state)
    console.log('Saving profile:', updatedProfile, newAvatarUri, newBannerUri);

    // Update the local profile data
    setProfile((prevProfile) => ({
      ...prevProfile,
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarUri,
      banner: newBannerUri,
    }));

    // upload blobs if necessary
    let newAvatarBlob;
    let newBannerBlob;
    if (newAvatarUri) {
      // if it is http/s url then do nothing
      if (!newAvatarUri.startsWith('http')) {
        console.log('Uploading avatar');
        // its a b64 encoded data uri, decode it and get a blob
        const data = await fetch(newAvatarUri).then((r) => r.blob());
        const fileType = newAvatarUri.split(';')[0].split(':')[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newAvatarBlob = await pdsAgent.uploadBlob(blob);
      }
    }
    if (newBannerUri) {
      if (!newBannerUri.startsWith('http')) {
        console.log('Uploading banner');
        const data = await fetch(newBannerUri).then((r) => r.blob());
        const fileType = newBannerUri.split(';')[0].split(':')[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newBannerBlob = await pdsAgent.uploadBlob(blob);
      }
    }

    console.log('done uploading');

    let record: ProfileRecord = {
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarBlob?.data.blob,
      banner: newBannerBlob?.data.blob,
    };

    console.log(record);

    // delete existing record
    await pdsAgent.call(
      'com.atproto.repo.deleteRecord',
      {},
      {
        repo: pdsAgent.did,
        collection: 'fm.teal.alpha.actor.profile',
        rkey: 'self',
      },
    );

    // submit the profile to our PDS
    let post = await pdsAgent.call(
      'com.atproto.repo.createRecord',
      {},
      {
        repo: pdsAgent.did,
        collection: 'fm.teal.alpha.actor.profile',
        rkey: 'self',
        record,
      },
    );

    console.log(post);

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
                <Text>{profile.displayName?.substring(0, 1) ?? 'R'}</Text>
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-left flex w-full justify-between mt-2">
              {profile.displayName ?? ' Richard'}
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
              <Button variant="outline" size="sm" className="">
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
            ? profile.description?.split('\n').map((str, i) => (
                <Text
                  className="text-start self-start place-self-start"
                  key={i}
                >
                  {str}
                </Text>
              )) || <Text>'A very mysterious person'</Text>
            : 'Loading...'}
        </View>
      </View>
      <View className="max-w-2xl w-full gap-4 py-4 pl-8">
        <Text className="text-left text-2xl border-b border-b-muted-foreground/30 -ml-2 pl-2 mr-6">
          Your Stamps
        </Text>
        <ActorPlaysView repo={actorDid} />
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
