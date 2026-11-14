import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Disc3, ImagePlus, UserRoundPen } from "lucide-react-native";
import { isMissingProfileRecord } from "@teal/client/atp/firstLogin";
import { ProfileImageError, saveProfileRecord } from "@teal/client/atp/profileRecord";
import {
  Button,
  ButtonRow,
  ErrorNotice,
  Field,
  Glass,
  Heading,
  Icon,
  Loading,
  Notice,
  PageTitle,
  Text,
} from "@/components/ds";
import { useStore } from "@/stores/mainStore";

type ProfileStatus = { completedOnboarding?: string; createdAt?: string };

/** First run: name, bio, and artwork for your teal profile, started from your Bluesky details. */
export default function Onboarding() {
  const agent = useStore((state) => state.pdsAgent);
  const status = useStore((state) => state.status);
  const bsky = useStore((state) => (agent?.did ? state.profiles[agent.did]?.bsky : undefined));
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ["profile-status", agent?.did],
    enabled: !!agent?.did,
    queryFn: async (): Promise<ProfileStatus | null> => {
      try {
        const res = await agent!.call("com.atproto.repo.getRecord", {
          repo: agent!.did!,
          collection: "fm.teal.actor.profileStatus",
          rkey: "self",
        });
        return res.data.value as ProfileStatus;
      } catch (e) {
        if (isMissingProfileRecord(e)) return null;
        throw e;
      }
    },
  });

  useEffect(() => {
    if (!bsky) return;
    setName((current) => current || bsky.displayName || "");
    setBio((current) => current || bsky.description || "");
    setAvatar((current) => current || bsky.avatar || "");
    setBanner((current) => current || bsky.banner || "");
  }, [bsky]);

  const pick = async (kind: "avatar" | "banner") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: kind === "avatar" ? [1, 1] : [3, 1],
      quality: 0.9,
    });
    if (result.canceled) return;
    if (kind === "avatar") setAvatar(result.assets[0].uri);
    else setBanner(result.assets[0].uri);
  };

  const save = async () => {
    if (!agent?.did || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfileRecord(agent, { displayName: name, description: bio, avatarUri: avatar, bannerUri: banner }, {});
      const now = new Date().toISOString();
      await agent.call(
        "com.atproto.repo.putRecord",
        {},
        {
          repo: agent.did,
          collection: "fm.teal.actor.profileStatus",
          rkey: "self",
          record: {
            $type: "fm.teal.actor.profileStatus",
            completedOnboarding: "profileOnboarding",
            createdAt: existing.data?.createdAt || now,
            updatedAt: now,
          },
        },
      );
      router.replace(`/profile/${agent.did}`);
    } catch (e) {
      setError(e instanceof ProfileImageError ? e.message : "Your profile didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <ScrollView
      className="flex-1 bg-ground"
      contentContainerClassName="items-center px-4"
      contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <PageTitle title="Set up your profile" />
      <View className="w-full max-w-lg gap-4">{children}</View>
    </ScrollView>
  );

  if (status === "start") return shell(<Loading />);
  if (!agent?.did) {
    return shell(
      <Notice
        icon={Disc3}
        title="Create your teal profile"
        body="Sign in with your Bluesky or other Atmosphere account to set up your music profile."
        action={
          <Link href="/auth/login" asChild>
            <Button label="Sign in" />
          </Link>
        }
      />,
    );
  }
  if (existing.isLoading) return shell(<Loading label="Checking your profile" />);
  if (existing.isError) {
    return shell(<ErrorNotice title="Couldn't check your profile" body="Your profile hasn't changed. Check your connection and try again." onRetry={() => existing.refetch()} />);
  }

  return shell(
    <>
      <View className="gap-1">
        <Heading level={1}>Your teal profile</Heading>
        <Text className="text-[16px] text-ink-2">
          {existing.data ? "Update how you show up on teal." : "We've started it from your Bluesky profile. Change anything you like."}
        </Text>
      </View>
      <Glass strong className="gap-4 p-5">
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a banner" onPress={() => pick("banner")}>
          <View className="aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-[16px] bg-fill">
            {banner ? (
              <Image source={{ uri: banner }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View className="items-center gap-1">
                <Icon icon={ImagePlus} size={24} className="text-ink-2" />
                <Text className="text-[14px] text-ink-2">Add a banner</Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a profile picture" onPress={() => pick("avatar")} className="-mt-14 ml-4 self-start">
          <View className="h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-ground bg-tint">
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <Icon icon={UserRoundPen} size={28} className="text-on-tint" />
            )}
          </View>
        </Pressable>
        <Field label="Display name" value={name} onChangeText={setName} maxLength={64} />
        <Field label="Bio" value={bio} onChangeText={setBio} multiline maxLength={256} hint="A line about you and what you listen to." />
        <Text className="text-[13px] text-ink-2">Images must be PNG or JPEG, under 1 MB.</Text>
        {error ? (
          <Text role="alert" className="text-[14px] text-destructive">
            {error}
          </Text>
        ) : null}
        <ButtonRow>
          <Button label={saving ? "Saving" : "Save profile"} loading={saving} disabled={!name.trim()} onPress={save} />
          <Link href="/" asChild>
            <Button label="Skip for now" variant="secondary" />
          </Link>
        </ButtonRow>
      </Glass>
    </>,
  );
}
