import { RichText, type Agent, type BlobRef as SdkBlobRef } from "@atproto/api";
import {
  $parse as parseProfileRecord,
  type Main as ProfileRecord,
} from "@teal/lexicons/src/fm/teal/actor/profile";

import { uploadProfileImage } from "../profileImage";
import { isRecordNotFound } from "./firstLogin";
import type { StatsPeriod } from "../teal/api";

/** A stored image: as read back from the repo, or as just uploaded through the SDK. */
type ProfileImage = ProfileRecord["avatar"] | SdkBlobRef;

/** The profile record as written. The SDK serialises its BlobRef instances on write. */
type ProfileWrite = Omit<ProfileRecord, "avatar" | "banner"> & {
  avatar?: ProfileImage;
  banner?: ProfileImage;
};

export type FavouriteItem = { mbid: string; type: string };

export const MAX_FAVOURITES = 4;

export { ProfileImageError } from "../profileImage";

export type ProfileEdits = {
  displayName: string;
  description: string;
  statsDefaultPeriod?: StatsPeriod;
  /** Leave out to keep the record's current favourites. */
  favourites?: FavouriteItem[];
  /** Pass a URI only when replacing the saved image. */
  avatarUri?: string;
  bannerUri?: string;
};

/**
 * Writes the signed-in account's fm.teal.actor.profile record, keeping fields this
 * form doesn't edit and swapping on the current CID so concurrent edits don't clobber.
 */
export async function saveProfileRecord(
  agent: Agent,
  edits: ProfileEdits,
) {
  const repo = agent.assertDid;
  let existing: ProfileRecord | undefined;
  let swapRecord: string | undefined;

  try {
    const res = await agent.call("com.atproto.repo.getRecord", { repo, collection: "fm.teal.actor.profile", rkey: "self" });
    // SAFETY: this is the account's own fm.teal.actor.profile record. Fields this save
    // changes are validated below; the rest are written back as they were read.
    existing = res.data.value as ProfileRecord;
    swapRecord = res.data.cid;
  } catch (error) {
    // Only a missing record means "create one"; a failed read must not overwrite it.
    if (!isRecordNotFound(error)) throw error;
  }

  const description = new RichText({ text: edits.description.trim() });
  await description.detectFacets(agent);

  const upload = async (blob: Blob, encoding: string) =>
    (await agent.uploadBlob(blob, { encoding })).data.blob;

  const avatar = await uploadProfileImage<ProfileImage>(edits.avatarUri, existing?.avatar, upload);
  const banner = await uploadProfileImage<ProfileImage>(edits.bannerUri, existing?.banner, upload);

  // Only validate what this save changes. Older records can hold images and bios over
  // today's limits, and those shouldn't block editing something else. The API client also
  // returns images as BlobRef instances the validator rejects; new uploads are already
  // checked by prepareProfileImage.
  const bioUnchanged = description.text === existing?.description;

  const validated = parseProfileRecord({
    ...existing,
    $type: "fm.teal.actor.profile",
    displayName: edits.displayName.trim(),
    description: bioUnchanged ? undefined : description.text,
    descriptionFacets: description.facets,
    avatar: undefined,
    banner: undefined,
    statsDefaultPeriod: edits.statsDefaultPeriod ?? existing?.statsDefaultPeriod,
    favorites: edits.favourites ? (edits.favourites.length ? edits.favourites : undefined) : existing?.favorites,
  });

  const record: ProfileWrite = { ...validated };

  if (bioUnchanged) record.description = description.text;

  if (avatar) record.avatar = avatar;

  if (banner) record.banner = banner;

  if (swapRecord) {
    await agent.com.atproto.repo.putRecord({ repo, collection: "fm.teal.actor.profile", rkey: "self", record, swapRecord });
  } else {
    await agent.com.atproto.repo.createRecord({ repo, collection: "fm.teal.actor.profile", rkey: "self", record });
  }
}
