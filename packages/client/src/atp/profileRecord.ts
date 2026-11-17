import { RichText, type Agent, type BlobRef as SdkBlobRef } from "@atproto/api";
import {
  $parse as parseProfileRecord,
  type Main as ProfileRecord,
} from "@teal/lexicons/src/fm/teal/actor/profile";

import { prepareProfileImage } from "../profileImage";
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

/**
 * Upload a newly picked image, or keep the current blob when it didn't change.
 * Images are checked against the lexicon (PNG or JPEG, under 1 MB); its messages
 * are written for people, so callers can show them.
 */
async function uploadIfChanged(
  agent: Agent,
  uri: string,
  currentBlob?: ProfileImage,
  currentUrl?: string,
): Promise<ProfileImage> {
  if (!uri) return undefined;

  if (currentBlob && uri === currentUrl) return currentBlob;
  const response = await fetch(uri);

  if (!response.ok) throw new ProfileImageError("Couldn't read the image. Choose it again.");
  let image;

  try {
    image = await prepareProfileImage(await response.blob());
  } catch (error) {
    throw new ProfileImageError(error instanceof Error ? error.message : "Choose a PNG or JPEG image.");
  }

  return (await agent.uploadBlob(image.blob, { encoding: image.encoding })).data.blob;
}

/** A picked image can't be used; the message says why. */
export class ProfileImageError extends Error {}

export type ProfileEdits = {
  displayName: string;
  description: string;
  statsDefaultPeriod?: StatsPeriod;
  /** Leave out to keep the record's current favourites. */
  favourites?: FavouriteItem[];
  /** The image to show: an existing URL, or a picked local URI. Empty removes it. */
  avatarUri: string;
  bannerUri: string;
};

/**
 * Writes the signed-in account's fm.teal.actor.profile record, keeping fields this
 * form doesn't edit and swapping on the current CID so concurrent edits don't clobber.
 */
export async function saveProfileRecord(
  agent: Agent,
  edits: ProfileEdits,
  current: { avatarUrl?: string; bannerUrl?: string },
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
  const avatar = await uploadIfChanged(agent, edits.avatarUri, existing?.avatar, current.avatarUrl);
  const banner = await uploadIfChanged(agent, edits.bannerUri, existing?.banner, current.bannerUrl);

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
