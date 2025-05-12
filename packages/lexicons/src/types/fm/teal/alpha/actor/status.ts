/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { BlobRef, ValidationResult } from "@atproto/lexicon";
import { CID } from "multiformats/cid";

import { lexicons } from "../../../../../lexicons";
import { hasProp, isObj } from "../../../../../util";
import * as FmTealAlphaFeedDefs from "../feed/defs";

export interface Record {
  /** The unix timestamp of when the item was recorded */
  time: string;
  item: FmTealAlphaFeedDefs.PlayView;
  [k: string]: unknown;
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, "$type") &&
    (v.$type === "fm.teal.alpha.actor.status#main" ||
      v.$type === "fm.teal.alpha.actor.status")
  );
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate("fm.teal.alpha.actor.status#main", v);
}
