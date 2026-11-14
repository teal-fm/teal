import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Disc3, ImagePlus, UserRoundPen } from "lucide-react";
import { isMissingProfileRecord } from "@teal/client/atp/firstLogin";
import { ProfileImageError, saveProfileRecord } from "@teal/client/atp/profileRecord";
import { AmbientScreen, Button, ButtonRow, ErrorNotice, Field, Glass, Heading, Icon, LinkButton, Loading, Notice, TextArea, useDocumentTitle, useGo } from "~/ds";
import { ImagePick } from "~/components/profile/ImagePick";
import { refreshViewerProfile, useAuth } from "~/lib/auth";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile · Teal" }] }),
  component: Onboarding,
});

type ProfileStatus = { completedOnboarding?: string; createdAt?: string };

function Shell({ children }: { children: ReactNode }) {
  useDocumentTitle("Set up your profile");
  return (
    <AmbientScreen>
      <main className="flex justify-center px-4 pt-8 pb-[110px] nav:pb-10">
        <div className="flex w-full max-w-lg flex-col gap-4">{children}</div>
      </main>
    </AmbientScreen>
  );
}

/** First run: name, bio, and artwork for your teal profile, started from your Bluesky details. */
function Onboarding() {
  const agent = useAuth((state) => state.agent);
  const status = useAuth((state) => state.status);
  const bsky = useAuth((state) => state.profile?.bsky);
  const go = useGo();
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
        const res = await agent!.call("com.atproto.repo.getRecord", { repo: agent!.did!, collection: "fm.teal.actor.profileStatus", rkey: "self" });
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

  const save = async (event: FormEvent) => {
    event.preventDefault();
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
      refreshViewerProfile();
      void go(`/profile/${agent.did}`, { replace: true });
    } catch (e) {
      setError(e instanceof ProfileImageError ? e.message : "Your profile didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "start") {
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  }
  if (!agent?.did) {
    return (
      <Shell>
        <Notice
          icon={Disc3}
          title="Create your teal profile"
          body="Sign in with your Bluesky or other Atmosphere account to set up your music profile."
          action={<LinkButton href="/auth/login" label="Sign in" />}
        />
      </Shell>
    );
  }
  if (existing.isLoading) {
    return (
      <Shell>
        <Loading label="Checking your profile" />
      </Shell>
    );
  }
  if (existing.isError) {
    return (
      <Shell>
        <ErrorNotice title="Couldn't check your profile" body="Your profile hasn't changed. Check your connection and try again." onRetry={() => existing.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1">
        <Heading level={1} onBackdrop>
          Your teal profile
        </Heading>
        <p className="halo text-[16px] text-ink-2">
          {existing.data ? "Update how you show up on teal." : "We've started it from your Bluesky profile. Change anything you like."}
        </p>
      </div>
      <Glass strong className="p-5">
        <form onSubmit={save} className="flex flex-col gap-4">
          <ImagePick label="Choose a banner" onPick={setBanner} className="block w-full">
            <span className="flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-[16px] bg-fill hover:brightness-95">
              {banner ? (
                <img src={banner} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[14px] text-ink-2">
                  <Icon icon={ImagePlus} size={24} className="text-ink-2" />
                  Add a banner
                </span>
              )}
            </span>
          </ImagePick>
          <ImagePick label="Choose a profile picture" onPick={setAvatar} className="-mt-14 ml-4 self-start rounded-full">
            <span className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-ground bg-tint">
              {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <Icon icon={UserRoundPen} size={28} className="text-on-tint" />}
            </span>
          </ImagePick>
          <Field label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={64} />
          <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={256} hint="A line about you and what you listen to." />
          <p className="text-[13px] text-ink-2">Images must be PNG or JPEG, under 1 MB.</p>
          {error ? (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          ) : null}
          <ButtonRow>
            <Button type="submit" label={saving ? "Saving" : "Save profile"} loading={saving} disabled={!name.trim()} />
            <LinkButton href="/" label="Skip for now" variant="secondary" />
          </ButtonRow>
        </form>
      </Glass>
    </Shell>
  );
}
