import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import AuthPageTitle from "@/components/auth/AuthPageTitle";
import DescriptionPage from "@/components/onboarding/descriptionPage";
import DisplayNamePage from "@/components/onboarding/displayNamePage";
import ImageSelectionPage from "@/components/onboarding/imageSelectionPage";
import ProgressDots from "@/components/onboarding/progressDots";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { isMissingProfileRecord } from "@/lib/atp/firstLogin";
import { profileRecordBlob } from "@/lib/atp/profileBlob";
import { Icon } from "@/lib/icons/iconWithClassName";
import { prepareProfileImage } from "@/lib/profileImage";
import { useStore } from "@/stores/mainStore";
import { RichText as AtprotoRichText, jsonToLex } from "@atproto/api";
import { ArrowLeft, Check, Disc3, Music2, Sparkles } from "lucide-react-native";

import {
  $parse as parseProfileRecord,
  Main as ProfileRecord,
} from "@teal/lexicons/src/fm/teal/actor/profile";
import { Main as ProfileStatusRecord } from "@teal/lexicons/src/fm/teal/actor/profileStatus";

const OnboardingSubmissionSteps: string[] = [
  "",
  "Checking your profile",
  "Saving your avatar",
  "Saving your banner",
  "Saving your profile",
  "Profile saved",
];

export default function OnboardingPage() {
  const accountDid = useStore((state) => state.pdsAgent?.did);
  const authStatus = useStore((state) => state.status);
  return (
    <>
      <AuthPageTitle path="/onboarding" title="Set up your profile" />
      {authStatus === "start" ? (
        <View className="min-h-screen flex-1 items-center justify-center bg-background">
          <ActivityIndicator accessibilityLabel="Checking your account" />
        </View>
      ) : (
        <OnboardingFlow key={accountDid || "signed-out"} />
      )}
    </>
  );
}

function OnboardingFlow() {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUri, setAvatarUri] = useState("");
  const [bannerUri, setBannerUri] = useState("");

  const [submissionStep, setSubmissionStep] = useState(0);
  const [submissionError, setSubmissionError] = useState<string>();
  const [completed, setCompleted] = useState(false);
  const [statusError, setStatusError] = useState(false);
  const [statusAttempt, setStatusAttempt] = useState(0);
  const submitting = useRef(false);

  // Profile status hooks - must be at top level
  const [profileStatus, setProfileStatus] =
    useState<ProfileStatusRecord | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

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

  useEffect(() => {
    let mounted = true;
    if (!agent) return;
    setStatusLoading(true);
    setStatusError(false);
    const checkProfileStatus = async () => {
      try {
        const res = await agent.call("com.atproto.repo.getRecord", {
          repo: agent.did,
          collection: "fm.teal.actor.profileStatus",
          rkey: "self",
        });
        const status = res.data.value as ProfileStatusRecord;
        // A previously completed setup does not imply the profile still exists.
        if (status.completedOnboarding !== "none") {
          await agent.call("com.atproto.repo.getRecord", {
            repo: agent.did,
            collection: "fm.teal.actor.profile",
            rkey: "self",
          });
        }
        if (mounted) setProfileStatus(status);
      } catch (error) {
        if (!mounted) return;
        if (isMissingProfileRecord(error)) setProfileStatus(null);
        else setStatusError(true);
      } finally {
        if (mounted) setStatusLoading(false);
      }
    };
    void checkProfileStatus();
    return () => {
      mounted = false;
    };
  }, [agent, statusAttempt]);

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
    updatedProfile: { displayName: string; description: string },
    newAvatarUri: string | undefined,
    newBannerUri: string | undefined,
  ) => {
    if (!agent || submitting.current) return;
    submitting.current = true;
    setSubmissionError(undefined);
    setSubmissionStep(1);
    try {
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
        // A missing record is expected for a new account. Other failures must
        // not be mistaken for permission to overwrite an existing profile.
        if ((error as { error?: string })?.error !== "RecordNotFound")
          throw error;
      }
      const uploadImage = async (uri: string, progress: number) => {
        setSubmissionStep(progress);
        const response = await fetch(uri);
        if (!response.ok)
          throw new Error(
            "Couldn't read the image. Choose it again and retry.",
          );
        const image = await prepareProfileImage(await response.blob());
        return (
          await agent.uploadBlob(image.blob, { encoding: image.encoding })
        ).data.blob;
      };
      const avatar = newAvatarUri
        ? await uploadImage(newAvatarUri, 2)
        : currentUser?.avatar;
      const banner = newBannerUri
        ? await uploadImage(newBannerUri, 3)
        : currentUser?.banner;
      setSubmissionStep(4);
      const bio = new AtprotoRichText({ text: updatedProfile.description });
      await bio.detectFacets(agent);
      const record: ProfileRecord = parseProfileRecord({
        ...currentUser,
        $type: "fm.teal.actor.profile",
        displayName: updatedProfile.displayName,
        description: updatedProfile.description,
        descriptionFacets: bio.facets,
        avatar: profileRecordBlob(avatar, jsonToLex),
        banner: profileRecordBlob(banner, jsonToLex),
      });
      await agent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.actor.profile",
          rkey: "self",
          record,
          ...(cid ? { swapRecord: cid } : {}),
        },
      );
      const status: ProfileStatusRecord = {
        $type: "fm.teal.actor.profileStatus",
        completedOnboarding: "profileOnboarding",
        createdAt:
          profileStatus?.createdAt ||
          (new Date().toISOString() as ProfileStatusRecord["createdAt"]),
        updatedAt: new Date().toISOString() as ProfileStatusRecord["updatedAt"],
      };
      await agent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.actor.profileStatus",
          rkey: "self",
          record: status,
        },
      );
      setSubmissionStep(5);
      setCompleted(true);
    } catch (error) {
      setSubmissionStep(0);
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We couldn't save your profile. Check your connection and try again.",
      );
    } finally {
      submitting.current = false;
    }
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
            Sign in with your Bluesky or other Atmosphere account to set up your
            music profile.
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

  if (statusError) {
    return (
      <SafeAreaView className="min-h-screen flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-md gap-4 rounded-xl bg-card p-6">
          <Text accessibilityRole="header" className="text-2xl font-bold">
            Couldn't check your profile
          </Text>
          <Text accessibilityRole="alert" className="text-muted-foreground">
            Check your connection and try again. Your profile hasn't been
            changed.
          </Text>
          <Button onPress={() => setStatusAttempt((attempt) => attempt + 1)}>
            <Text>Try again</Text>
          </Button>
          <Link href="/" asChild>
            <Button variant="ghost">
              <Text>Back to Teal</Text>
            </Button>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (
    completed ||
    (profileStatus && profileStatus.completedOnboarding !== "none")
  ) {
    return (
      <SafeAreaView className="min-h-screen flex-1 items-center justify-center bg-background px-6">
        <View className="w-full max-w-md items-start gap-4 rounded-lg border border-border bg-card p-6">
          <Icon icon={Check} size={42} className="text-primary" />
          <Text
            accessibilityRole="header"
            className="font-sans text-3xl font-black"
          >
            Your Teal profile is ready
          </Text>
          <Text className="text-muted-foreground">
            {completed
              ? "Save your first listen to start sharing the music you love. You can update your profile any time."
              : "Your profile is already set up. Add a listen or return to your profile."}
          </Text>
          <View className="w-full gap-3">
            <Link href="/manual-listens" asChild>
              <Button>
                <Text>
                  {completed ? "Add your first listen" : "Add a listen"}
                </Text>
              </Button>
            </Link>
            <Link href={`/profile/${agent.did}` as any} asChild>
              <Button variant="outline">
                <Text>View profile</Text>
              </Button>
            </Link>
          </View>
          {completed && (
            <Text className="text-sm text-muted-foreground">
              Profile saved. It may take a moment to appear for other listeners.
            </Text>
          )}
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
          Saving your profile. Your name, bio, and images will stay here if you
          need to retry.
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
            onBack={(draft) => {
              setDescription(draft);
              setStep(1);
            }}
          />
        );
      case 3:
        return (
          <ImageSelectionPage
            onComplete={handleImageSelectionComplete}
            initialAvatar={avatarUri}
            initialBanner={bannerUri}
            error={submissionError}
            onBack={(avatar, banner) => {
              setAvatarUri(avatar || "");
              setBannerUri(banner || "");
              setStep(2);
            }}
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
              Share your listening history and the music you love. Your profile
              belongs to your account and travels with you.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Icon icon={Music2} size={18} className="text-secondary" />
            <Text className="font-mono text-xs text-background/55">
              Your music, your profile.
            </Text>
          </View>
        </View>
        <View className="min-h-screen flex-1 px-5 py-8 md:px-12">
          <View className="mx-auto w-full max-w-2xl flex-1">
            <Link href="/" asChild>
              <Button variant="ghost" className="mb-4 self-start lg:hidden">
                <Icon icon={ArrowLeft} size={18} className="text-foreground" />
                <Text className="ml-2">Back to Teal</Text>
              </Button>
            </Link>
            <View className="mb-8 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Icon icon={Sparkles} size={20} className="text-primary" />
                <Text className="font-sans text-base font-bold text-foreground">
                  teal.fm
                </Text>
              </View>
              <Text className="font-mono text-xs text-muted-foreground">
                Step {step} of 3
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
