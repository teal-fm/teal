import type { Agent, BlobRef } from "@atproto/api";
import type { Record as ProfileRecord } from "@teal/lexicons/src/types/fm/teal/actor/profile";
import { uploadProfileImage, type SelectedProfileImage } from "../profileImage";
import {
  LEGACY_PROFILE_COLLECTION,
  readRepoRecordWithLegacyFallback,
  STABLE_PROFILE_COLLECTION,
} from "./onboardingRecords";

type ProfileEdits = Pick<ProfileRecord, "displayName" | "description"> & {
  avatar?: SelectedProfileImage;
  banner?: SelectedProfileImage;
};

type ProfileWrite = Omit<ProfileRecord, "avatar" | "banner"> & {
  avatar?: ProfileRecord["avatar"] | BlobRef;
  banner?: ProfileRecord["banner"] | BlobRef;
};

export async function saveProfileRecord(
  agent: Agent,
  edits: ProfileEdits,
  onStage?: (stage: "avatar" | "banner" | "record") => void,
): Promise<ProfileWrite> {
  const current = await readRepoRecordWithLegacyFallback<ProfileRecord>(
    agent,
    STABLE_PROFILE_COLLECTION,
    LEGACY_PROFILE_COLLECTION,
  );
  const record: ProfileWrite = {
    ...current?.record,
    $type: STABLE_PROFILE_COLLECTION,
    displayName: edits.displayName,
    description: edits.description,
  };

  if (edits.avatar) {
    onStage?.("avatar");
    record.avatar = await uploadProfileImage(agent, edits.avatar);
  }
  if (edits.banner) {
    onStage?.("banner");
    record.banner = await uploadProfileImage(agent, edits.banner);
  }

  onStage?.("record");
  const input = { repo: agent.did, collection: STABLE_PROFILE_COLLECTION, rkey: "self", record };
  if (current?.collection === STABLE_PROFILE_COLLECTION && current.cid) {
    await agent.call("com.atproto.repo.putRecord", {}, { ...input, swapRecord: current.cid });
  } else {
    await agent.call("com.atproto.repo.createRecord", {}, input);
  }
  return record;
}
