import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, UserRoundPen, X } from "lucide-react";
import { MAX_FAVOURITES, ProfileImageError, saveProfileRecord, type FavouriteItem } from "@teal/client/atp/profileRecord";
import { profileKeys, type DisplayProfile } from "@teal/client/hooks/useProfile";
import { usePdsAgent } from "@teal/client/session";
import { getProfileImageUrl } from "@teal/client/teal/actors";
import { getUserTopReleases, type StatsPeriod } from "@teal/client/teal/api";
import { normalizePeriod, STATS_PERIODS } from "@teal/client/teal/topStats";
import { cn } from "@teal/client/utils";
import { Button, Choices, Cover, Field, Heading, Icon, IconButton, Spinner, TextArea } from "~/ds";
import { refreshViewerProfile } from "~/lib/auth";

import { ImagePick } from "./ImagePick";

const plain = (mbid: string) => mbid.replace(/^mbid:/, "");

/** Pick up to four favourite albums from your most-played releases. */
function FavouritesPicker({ did, value, onChange }: { did: string; value: FavouriteItem[]; onChange: (next: FavouriteItem[]) => void }) {
  const top = useQuery({
    queryKey: ["top-releases", did, "all"],
    queryFn: () => getUserTopReleases(did, "all", 24),
    staleTime: 10 * 60_000,
  });
  const releases = (top.data?.releases ?? []).filter((r) => r.mbid);
  const toggle = (mbid: string) => {
    const index = value.findIndex((f) => plain(f.mbid) === mbid);
    if (index >= 0) onChange(value.filter((_, i) => i !== index));
    else if (value.length < MAX_FAVOURITES) onChange([...value, { mbid: `mbid:${mbid}`, type: "release" }]);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[14px] font-semibold">
        Favourites ({value.length}/{MAX_FAVOURITES})
      </legend>
      <p className="text-[14px] text-ink-2">Choose up to four albums from what you play most. Press again to remove.</p>
      {top.isLoading ? (
        <Spinner />
      ) : releases.length === 0 ? (
        <p className="text-[14px] text-ink-2">Once you have listening history, your top albums appear here.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {releases.map((release) => {
            const mbid = plain(release.mbid!);
            const order = value.findIndex((f) => plain(f.mbid) === mbid);
            const full = order < 0 && value.length >= MAX_FAVOURITES;
            return (
              <button
                key={mbid}
                type="button"
                role="checkbox"
                aria-checked={order >= 0}
                disabled={full}
                aria-label={release.name}
                title={release.name}
                onClick={() => toggle(mbid)}
                className="relative rounded-[8px] disabled:opacity-40"
              >
                <Cover releaseMbId={mbid} size={64} radius={8} className={order >= 0 ? "ring-2 ring-tint" : undefined} />
                {order >= 0 ? (
                  <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-tint text-[11px] font-bold text-on-tint">
                    {order + 1}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

/** Edit your teal profile: images, name, bio, the default stats period, and favourites. */
export function EditProfileSheet({
  did,
  profile,
  visible,
  onClose,
}: {
  did: string;
  profile?: DisplayProfile;
  visible: boolean;
  onClose: () => void;
}) {
  const agent = usePdsAgent();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const avatarUrl = getProfileImageUrl(did, profile?.avatar, "avatar");
  const bannerUrl = getProfileImageUrl(did, profile?.banner, "banner");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [period, setPeriod] = useState<StatsPeriod>("90days");
  const [favourites, setFavourites] = useState<FavouriteItem[]>([]);
  const [avatarUri, setAvatarUri] = useState("");
  const [bannerUri, setBannerUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (visible && !node.open) node.showModal();
    if (!visible && node.open) node.close();
    if (!visible) return;
    setDisplayName(profile?.displayName || "");
    setDescription(profile?.description || "");
    setPeriod(normalizePeriod(profile?.statsDefaultPeriod));
    setFavourites((profile?.favorites as FavouriteItem[] | undefined) ?? []);
    setAvatarUri(avatarUrl || "");
    setBannerUri(bannerUrl || "");
    setError(null);
  }, [visible, profile, avatarUrl, bannerUrl]);

  const save = async () => {
    if (!agent || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveProfileRecord(
        agent,
        { displayName, description, statsDefaultPeriod: period, favourites, avatarUri, bannerUri },
        { avatarUrl, bannerUrl },
      );
      await client.invalidateQueries({ queryKey: profileKeys.profile(did) });
      refreshViewerProfile();
      onClose();
    } catch (e) {
      setError(e instanceof ProfileImageError ? e.message : "Your profile didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="edit-profile-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-[26px] border border-glass-edge bg-ground p-0 text-ink backdrop:bg-black/50 open:flex open:flex-col"
    >
      <div className="flex items-center justify-between border-b border-hair px-5 py-4">
        <Heading level={1} size="title" id="edit-profile-title">
          Edit profile
        </Heading>
        <IconButton icon={X} label="Close" size={36} onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
        <ImagePick label="Change banner image" onPick={setBannerUri} className="block w-full">
          <span className="flex aspect-[3/1] w-full items-center justify-center overflow-hidden rounded-[16px] bg-fill hover:brightness-95">
            {bannerUri ? (
              <img src={bannerUri} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-[14px] text-ink-2">
                <Icon icon={ImagePlus} size={24} className="text-ink-2" />
                Add a banner
              </span>
            )}
          </span>
        </ImagePick>
        <ImagePick label="Change profile picture" onPick={setAvatarUri} className="-mt-14 ml-4 self-start rounded-full">
          <span className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-ground bg-tint">
            {avatarUri ? <img src={avatarUri} alt="" className="size-full object-cover" /> : <Icon icon={UserRoundPen} size={28} className="text-on-tint" />}
          </span>
        </ImagePick>
        <Field label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={64} />
        <TextArea label="Bio" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={256} hint={`${description.length}/256`} />
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-semibold">Stats period shown first</p>
          <Choices label="Stats period shown first" value={period} onChange={setPeriod} options={STATS_PERIODS} />
        </div>
        <FavouritesPicker did={did} value={favourites} onChange={setFavourites} />
        <p className="text-[13px] text-ink-2">Images must be PNG or JPEG, under 1 MB.</p>
        {error ? (
          <p role="alert" className="text-[14px] text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <div className={cn("flex justify-end gap-2.5 border-t border-hair px-5 py-4")}>
        <Button label="Cancel" variant="secondary" onClick={onClose} />
        <Button label={saving ? "Saving" : "Save"} loading={saving} onClick={save} />
      </div>
    </dialog>
  );
}
