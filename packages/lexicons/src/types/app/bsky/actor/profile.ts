/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { BlobRef, ValidationResult } from "@atproto/lexicon";
import { CID } from "multiformats/cid";

import { lexicons } from "../../../../lexicons";
import { hasProp, isObj } from "../../../../util";
import * as ComAtprotoLabelDefs from "../../../com/atproto/label/defs";
import * as ComAtprotoRepoStrongRef from "../../../com/atproto/repo/strongRef";

export interface Record {
  displayName?: string;
  /** Free-form profile description text. */
  description?: string;
  /** Small image to be displayed next to posts from account. AKA, 'profile picture' */
  avatar?: BlobRef;
  /** Larger horizontal image to display behind profile view. */
  banner?: BlobRef;
  labels?:
    | ComAtprotoLabelDefs.SelfLabels
    | { $type: string; [k: string]: unknown };
  joinedViaStarterPack?: ComAtprotoRepoStrongRef.Main;
  createdAt?: string;
  [k: string]: unknown;
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, "$type") &&
    (v.$type === "app.bsky.actor.profile#main" ||
      v.$type === "app.bsky.actor.profile")
  );
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate("app.bsky.actor.profile#main", v);
}
