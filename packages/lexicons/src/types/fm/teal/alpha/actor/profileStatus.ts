/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from "@atproto/lexicon";

import { lexicons } from "../../../../../lexicons";
import { hasProp, isObj } from "../../../../../util";

export interface Record {
  /** The onboarding completion status */
  completedOnboarding: "none" | "profileOnboarding" | "playOnboarding" | "complete";
  /** The timestamp when this status was created */
  createdAt?: string;
  /** The timestamp when this status was last updated */
  updatedAt?: string;
  [k: string]: unknown;
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, "$type") &&
    (v.$type === "fm.teal.alpha.actor.profileStatus#main" ||
      v.$type === "fm.teal.alpha.actor.profileStatus")
  );
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate("fm.teal.alpha.actor.profileStatus#main", v);
}
