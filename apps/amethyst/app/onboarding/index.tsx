import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ProgressDots from "@/components/onboarding/progressDots";
import { Text } from "@/components/ui/text"; // Your UI components

import { useStore } from "@/stores/mainStore";

import { Record as ProfileRecord } from "@teal/lexicons/src/types/fm/teal/alpha/actor/profile";
import { Record as ProfileStatusRecord } from "@teal/lexicons/src/types/fm/teal/alpha/actor/profileStatus";

import DescriptionPage from "./descriptionPage";
import DisplayNamePage from "./displayNamePage";
import ImageSelectionPage from "./imageSelectionPage"; // Separate page components

const OnboardingSubmissionSteps: string[] = [
  "",
  "Double checking everything",
  "Submitting Profile Picture",
  "Submitting Header Image",
  "Submitting Profile",
  "Done!",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [bannerUri, setBannerUri] = useState("");

  const [submissionStep, setSubmissionStep] = useState(0);


  // Profile status hooks - must be at top level
  const [profileStatus, setProfileStatus] = useState<ProfileStatusRecord | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const router = useRouter();

  const agent = useStore((store) => store.pdsAgent);
  const profile = useStore((store) => store.profiles);

  // Check profile status
  React.useEffect(() => {
    const checkProfileStatus = async () => {
      if (!agent) return;

      try {
        const res = await agent.call("com.atproto.repo.getRecord", {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profileStatus",
          rkey: "self",
        });
        setProfileStatus(res.data.value as ProfileStatusRecord);
      } catch {
        // If no record exists, user hasn't completed onboarding
        setProfileStatus(null);
      } finally {
        setStatusLoading(false);
      }
    };

    checkProfileStatus();
  }, [agent]);

  const handleImageSelectionComplete = (avatar: string, banner: string) => {
    setAvatarUri(avatar);
    setBannerUri(banner);
    onComplete({ displayName, description }, avatar, banner);
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
    console.log("Saving profile:", updatedProfile, newAvatarUri, newBannerUri);

    setSubmissionStep(1);

    // get the current user's profile (getRecord)
    let currentUser: ProfileRecord | undefined;
    let cid: string | undefined;
    try {
      const res = await agent.call("com.atproto.repo.getRecord", {
        repo: agent.did,
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
      console.log(newAvatarUri);
      // if it is http/s url then do nothing
      if (!newAvatarUri.startsWith("http")) {
        setSubmissionStep(2);
        console.log("Uploading avatar");
        // its a b64 encoded data uri, decode it and get a blob
        const data = await fetch(newAvatarUri).then((r) => r.blob());
        const fileType = newAvatarUri.split(";")[0].split(":")[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newAvatarBlob = (await agent.uploadBlob(blob)).data.blob;
      }
    }
    if (newBannerUri) {
      if (!newBannerUri.startsWith("http")) {
        setSubmissionStep(3);
        console.log("Uploading banner");
        const data = await fetch(newBannerUri).then((r) => r.blob());
        const fileType = newBannerUri.split(";")[0].split(":")[1];
        console.log(fileType);
        const blob = new Blob([data], { type: fileType });
        newBannerBlob = (await agent.uploadBlob(blob)).data.blob;
      }
    }

    console.log("done uploading");

    setSubmissionStep(4);

    let record: ProfileRecord = {
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarBlob,
      banner: newBannerBlob,
    };

    let post;

    if (cid) {
      post = await agent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profile",
          rkey: "self",
          record,
          swapRecord: cid,
        },
      );
    } else {
      post = await agent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profile",
          rkey: "self",
          record,
        },
      );
    }

    console.log(post);

    // Update profile status to mark onboarding as completed
    const profileStatusRecord: ProfileStatusRecord = {
      completedOnboarding: "profileOnboarding",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await agent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.alpha.actor.profileStatus",
          rkey: "self",
          record: profileStatusRecord,
        },
      );
    } catch {
      // If record already exists, update it
      try {
        await agent.call(
          "com.atproto.repo.putRecord",
          {},
          {
            repo: agent.did,
            collection: "fm.teal.alpha.actor.profileStatus",
            rkey: "self",
            record: {
              ...profileStatusRecord,
              completedOnboarding: "profileOnboarding",
              updatedAt: new Date().toISOString(),
            },
          },
        );
      } catch (updateError) {
        console.error("Error updating profile status:", updateError);
      }
    }

    setSubmissionStep(5);
    //redirect to / after 2 seconds
    setTimeout(() => {
      router.replace("/");
    }, 2000);
  };

  if (!agent || !profile[agent?.did!]) {
    return <div>Loading...</div>;
  }

  if (statusLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Checking profile status...</Text>
      </View>
    );
  }

  if (profileStatus && profileStatus.completedOnboarding !== "none") {
    return (
      <Text>
        Onboarding already completed: {profileStatus.completedOnboarding}
      </Text>
    );
  }

  if (submissionStep) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
      <View className="flex h-full min-h-max flex-1">{renderPage()}</View>
      <ProgressDots totalSteps={3} currentStep={step} />
    </SafeAreaView>
  );
}
