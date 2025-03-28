import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '@/components/ui/text'; // Your UI components
import ImageSelectionPage from './imageSelectionPage'; // Separate page components
import DisplayNamePage from './displayNamePage';
import DescriptionPage from './descriptionPage';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProgressDots from '@/components/onboarding/progressDots';

import { Record as ProfileRecord } from '@teal/lexicons/src/types/fm/teal/alpha/actor/profile';
import { useStore } from '@/stores/mainStore';
import { useRouter } from 'expo-router';

const OnboardingSubmissionSteps: string[] = [
  '',
  'Double checking everything',
  'Submitting Profile Picture',
  'Submitting Header Image',
  'Submitting Profile',
  'Done!',
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [bannerUri, setBannerUri] = useState('');

  const [submissionStep, setSubmissionStep] = useState(1);
  const [submissionError, setSubmissionError] = useState('');

  const router = useRouter();

  const agent = useStore((store) => store.pdsAgent);
  const profile = useStore((store) => store.profiles);

  const handleImageSelectionComplete = (avatar: string, banner: string) => {
    setAvatarUri(avatar);
    setBannerUri(banner);
    onComplete({ displayName, description }, avatarUri, bannerUri);
  };

  const handleDisplayNameComplete = (name: string) => {
    setDisplayName(name);
    setStep(2);
  };

  const handleDescriptionComplete = (desc: string) => {
    setDescription(desc);
    setStep(3);
  };

  const onComplete = async (
    updatedProfile: { displayName: any; description: any },
    newAvatarUri: string,
    newBannerUri: string,
  ) => {
    if (!agent) return;
    // Implement your save logic here (e.g., update your database or state)
    console.log('Saving profile:', updatedProfile, newAvatarUri, newBannerUri);

    setSubmissionStep(1);

    // upload blobs if necessary
    let newAvatarBlob;
    let newBannerBlob;
    if (newAvatarUri) {
      // if it is http/s url then do nothing
      if (!newAvatarUri.startsWith('http')) {
        setSubmissionStep(2);
        console.log('Uploading avatar');
        // its a b64 encoded data uri, decode it and get a blob
        const data = await fetch(newAvatarUri).then((r) => r.blob());
        const fileType = newAvatarUri.split(';')[0].split(':')[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newAvatarBlob = await agent.uploadBlob(blob);
      }
    }
    if (newBannerUri) {
      if (!newBannerUri.startsWith('http')) {
        setSubmissionStep(3);
        console.log('Uploading banner');
        const data = await fetch(newBannerUri).then((r) => r.blob());
        const fileType = newBannerUri.split(';')[0].split(':')[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newBannerBlob = await agent.uploadBlob(blob);
      }
    }

    console.log('done uploading');

    setSubmissionStep(4);

    let record: ProfileRecord = {
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarBlob?.data.blob,
      banner: newBannerBlob?.data.blob,
    };

    // submit the profile to our PDS
    let post = await agent.call(
      'com.atproto.repo.createRecord',
      {},
      {
        repo: agent.did,
        collection: 'fm.teal.alpha.actor.profile',
        rkey: 'self',
        record,
      },
    );

    console.log(post);
    setSubmissionStep(5);
    //redirect to / after 2 seconds
    setTimeout(() => {
      router.replace('/');
    }, 2000);
  };

  if (!agent) {
    return <div>Loading...</div>;
  }

  // if we already have stuff then go back
  //
  if (profile[agent?.did!].teal) {
    return (
      <Text>
        Profile already exists: {JSON.stringify(profile[agent?.did!].teal)}
      </Text>
    );
  }

  if (submissionStep) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>{OnboardingSubmissionSteps[submissionStep]}</Text>
      </View>
    );
  }

  const renderPage = () => {
    switch (step) {
      case 1:
        return (
          <DisplayNamePage
            onComplete={handleDisplayNameComplete}
            initialDisplayName={displayName}
            onBack={() => setStep(1)}
          />
        );
      case 2:
        return (
          <DescriptionPage
            onComplete={handleDescriptionComplete}
            initialDescription={description}
            onBack={() => setStep(2)}
          />
        );
      case 3:
        return (
          <ImageSelectionPage
            onComplete={handleImageSelectionComplete}
            initialAvatar={avatarUri}
            initialBanner={bannerUri}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 p-5 pt-5">
      <View className="flex-1 flex min-h-max h-full">{renderPage()}</View>
      <ProgressDots totalSteps={3} currentStep={step} />
    </SafeAreaView>
  );
}
