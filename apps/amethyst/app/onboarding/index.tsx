import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import ProgressDots from "@/components/onboarding/progressDots";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Icon } from "@/lib/icons/iconWithClassName";
import { useStore } from "@/stores/mainStore";
import { ArrowLeft, Check, Disc3, Music2, Sparkles } from "lucide-react-native";

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

  const router = useRouter();

  const agent = useStore((store) => store.pdsAgent);
  const profiles = useStore((store) => store.profiles);
  const profile = agent?.did ? profiles[agent.did] : undefined;

  useEffect(() => {
    if (!profile?.bsky) return;
    setDisplayName((current) => current || profile.bsky?.displayName || "");
    setDescription((current) => current || profile.bsky?.description || "");
    setAvatarUri((current) => current || profile.bsky?.avatar || "");
    setBannerUri((current) => current || profile.bsky?.banner || "");
  }, [profile?.bsky]);

  // Check profile status
  React.useEffect(() => {
    const checkProfileStatus = async () => {
      if (!agent) return;

      try {
        const res = await agent.call("com.atproto.repo.getRecord", {
          repo: agent.did,
          collection: "fm.teal.actor.profileStatus",
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
      const res = await agent.call("com.atproto.repo.getRecord", {
        repo: agent.did,
        collection: "fm.teal.actor.profile",
        rkey: "self",
      });
      currentUser = res.data.value;
      cid = res.data.cid;
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

    let record: ProfileRecord = {
      $type: "fm.teal.actor.profile",
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
          collection: "fm.teal.actor.profile",
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
          collection: "fm.teal.actor.profile",
          rkey: "self",
          record,
        },
      );
    }

    // Update profile status to mark onboarding as completed
    const profileStatusRecord: ProfileStatusRecord = {
      $type: "fm.teal.actor.profileStatus",
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
          collection: "fm.teal.actor.profileStatus",
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
            collection: "fm.teal.actor.profileStatus",
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

  if (!agent) {
    return (
      <SafeAreaView className="min-h-screen flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-md gap-4 rounded-lg border border-border bg-card p-6">
          <Icon icon={Disc3} size={42} className="text-primary" />
          <Text className="font-sans text-3xl font-black">
            Create your Teal profile
          </Text>
          <Text className="text-muted-foreground">
            Sign in with your ATProto account before setting up your music
            identity.
          </Text>
          <Link href="/auth/login" asChild>
            <Button>
              <Text>Sign in</Text>
            </Button>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <View className="min-h-screen flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (statusLoading) {
    return (
      <View className="min-h-screen flex-1 items-center justify-center gap-3 bg-background">
        <ActivityIndicator size="large" />
        <Text className="text-muted-foreground">
          Checking your Teal profile...
        </Text>
      </View>
    );
  }

  if (profileStatus && profileStatus.completedOnboarding !== "none") {
    return (
      <SafeAreaView className="min-h-screen flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-md items-start gap-4 rounded-lg border border-border bg-card p-6">
          <Icon icon={Check} size={42} className="text-primary" />
          <Text className="font-sans text-3xl font-black">
            Your Teal profile is ready
          </Text>
          <Text className="text-muted-foreground">
            Your music identity already exists. You can return to your profile
            and keep listening.
          </Text>
          <Link href={`/profile/${agent.did}` as any} asChild>
            <Button>
              <Text>View profile</Text>
            </Button>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (submissionStep) {
    return (
      <View className="min-h-screen flex-1 items-center justify-center gap-4 bg-background">
        <View className="h-20 w-20 items-center justify-center rounded-full border-8 border-primary/20 bg-primary/10">
          <ActivityIndicator size="large" />
        </View>
        <Text className="font-sans text-3xl font-black">
          {OnboardingSubmissionSteps[submissionStep]}
        </Text>
        <Text className="text-muted-foreground">
          Publishing your profile to the Atmosphere.
        </Text>
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
            onBack={() => setStep(2)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="min-h-screen flex-1 bg-background">
      <View className="z-10 min-h-screen flex-1 flex-row">
        <View className="hidden w-[20rem] justify-between border-r border-border bg-foreground p-8 lg:flex">
          <Link href="/" asChild>
            <Button variant="ghost" size="sm" className="self-start">
              <Icon icon={ArrowLeft} size={18} className="text-background" />
              <Text className="ml-2 text-background">Back to Teal</Text>
            </Button>
          </Link>
          <View className="gap-5">
            <View className="h-16 w-16 items-center justify-center rounded-full border-[7px] border-background">
              <View className="h-5 w-5 rounded-full bg-secondary" />
            </View>
            <Text className="font-sans text-4xl font-black text-background">
              Make it yours.
            </Text>
            <Text className="text-base leading-6 text-background/65">
              A Teal profile lives in your ATProto repository and follows your
              listening history across the Atmosphere.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Icon icon={Music2} size={18} className="text-secondary" />
            <Text className="font-mono text-xs text-background/55">
              fm.teal.actor.profile
            </Text>
          </View>
        </View>
        <View className="min-h-screen flex-1 px-5 py-8 md:px-12">
          <View className="mx-auto w-full max-w-2xl flex-1">
            <View className="mb-8 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Icon icon={Sparkles} size={20} className="text-primary" />
                <Text className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  Teal profile setup
                </Text>
              </View>
              <Text className="font-mono text-xs text-muted-foreground">
                0{step} / 03
              </Text>
            </View>
            <View className="flex-1 rounded-lg border border-border bg-card p-6 md:p-10">
              {renderPage()}
            </View>
            <ProgressDots totalSteps={3} currentStep={step} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
