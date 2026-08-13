import React, { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ProgressDots from "@/components/onboarding/progressDots";
import { Text } from "@/components/ui/text"; // Your UI components
import getImageCdnLink from "@/lib/atp/getImageCdnLink";
import {
  getBlobHash,
  LEGACY_PROFILE_COLLECTION,
  LEGACY_PROFILE_STATUS_COLLECTION,
  readRepoRecordWithLegacyFallback,
  STABLE_PROFILE_COLLECTION,
  STABLE_PROFILE_STATUS_COLLECTION,
} from "@/lib/atp/onboardingRecords";
import { useStore } from "@/stores/mainStore";

import { Record as ProfileRecord } from "@teal/lexicons/src/types/fm/teal/actor/profile";
import { Record as ProfileStatusRecord } from "@teal/lexicons/src/types/fm/teal/actor/profileStatus";

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
  const [profileStatus, setProfileStatus] =
    useState<ProfileStatusRecord | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const router = useRouter();

  const agent = useStore((store) => store.pdsAgent);
  const profile = useStore((store) => store.profiles);

  // Read both records with a legacy fallback so an existing user is never
  // treated as a new user just because the namespace changed.
  React.useEffect(() => {
    const checkProfileStatus = async () => {
      if (!agent) return;

      try {
        const result =
          await readRepoRecordWithLegacyFallback<ProfileStatusRecord>(
            agent,
            STABLE_PROFILE_STATUS_COLLECTION,
            LEGACY_PROFILE_STATUS_COLLECTION,
          );
        setProfileStatus(result?.record ?? null);
      } catch (error) {
        console.error("Error fetching profile status:", error);
        setProfileStatus(null);
      } finally {
        setStatusLoading(false);
      }
    };

    checkProfileStatus();
  }, [agent]);

  React.useEffect(() => {
    const loadProfile = async () => {
      if (!agent) return;

      try {
        const result = await readRepoRecordWithLegacyFallback<ProfileRecord>(
          agent,
          STABLE_PROFILE_COLLECTION,
          LEGACY_PROFILE_COLLECTION,
        );
        if (result) {
          setDisplayName(result.record.displayName ?? "");
          setDescription(result.record.description ?? "");

          const avatarHash = getBlobHash(result.record.avatar);
          const bannerHash = getBlobHash(result.record.banner);
          setAvatarUri(
            avatarHash
              ? (getImageCdnLink({ did: agent.did!, hash: avatarHash }) ?? "")
              : "",
          );
          setBannerUri(
            bannerHash
              ? (getImageCdnLink({ did: agent.did!, hash: bannerHash }) ?? "")
              : "",
          );
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [agent]);

  const handleImageSelectionComplete = (
    avatar: string | undefined,
    banner: string | undefined,
  ) => {
    setAvatarUri(avatar ?? "");
    setBannerUri(banner ?? "");
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
    newAvatarUri: string | undefined,
    newBannerUri: string | undefined,
  ) => {
    if (!agent) return;

    setSubmissionStep(1);

    // get the current user's profile (getRecord)
    let currentUser: ProfileRecord | undefined;
    let cid: string | undefined;
    try {
      const result = await readRepoRecordWithLegacyFallback<ProfileRecord>(
        agent,
        STABLE_PROFILE_COLLECTION,
        LEGACY_PROFILE_COLLECTION,
      );
      currentUser = result?.record;
      // A legacy record must be copied into the stable collection, not
      // updated in place. Its blob refs are retained below.
      cid =
        result?.collection === STABLE_PROFILE_COLLECTION
          ? result.cid
          : undefined;
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }

    // upload blobs if necessary
    let newAvatarBlob: ProfileRecord["avatar"] = currentUser?.avatar;
    let newBannerBlob: ProfileRecord["banner"] = currentUser?.banner;
    if (newAvatarUri) {
      if (!newAvatarUri.startsWith("http")) {
        setSubmissionStep(2);
        const data = await fetch(newAvatarUri).then((r) => r.blob());
        const fileType = newAvatarUri.split(";")[0].split(":")[1];
        const blob = new Blob([data], { type: fileType });
        newAvatarBlob = (await agent.uploadBlob(blob, { encoding: fileType }))
          .data.blob as unknown as ProfileRecord["avatar"];
      }
    }
    if (newBannerUri) {
      if (!newBannerUri.startsWith("http")) {
        setSubmissionStep(3);
        const data = await fetch(newBannerUri).then((r) => r.blob());
        const fileType = newBannerUri.split(";")[0].split(":")[1];
        const blob = new Blob([data], { type: fileType });
        newBannerBlob = (await agent.uploadBlob(blob, { encoding: fileType }))
          .data.blob as unknown as ProfileRecord["banner"];
      }
    }

    setSubmissionStep(4);

    const record: ProfileRecord = {
      ...currentUser,
      $type: STABLE_PROFILE_COLLECTION,
      displayName: updatedProfile.displayName,
      description: updatedProfile.description,
      avatar: newAvatarBlob,
      banner: newBannerBlob,
    };

    if (cid) {
      await agent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: agent.did,
          collection: STABLE_PROFILE_COLLECTION,
          rkey: "self",
          record,
          swapRecord: cid,
        },
      );
    } else {
      await agent.call(
        "com.atproto.repo.createRecord",
        {},
        {
          repo: agent.did,
          collection: STABLE_PROFILE_COLLECTION,
          rkey: "self",
          record,
        },
      );
    }

    // Update profile status to mark onboarding as completed
    const profileStatusRecord: ProfileStatusRecord = {
      $type: STABLE_PROFILE_STATUS_COLLECTION,
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
          collection: STABLE_PROFILE_STATUS_COLLECTION,
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
            collection: STABLE_PROFILE_STATUS_COLLECTION,
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

  if (statusLoading || profileLoading) {
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
