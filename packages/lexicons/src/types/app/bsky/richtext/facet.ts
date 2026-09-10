import type { AppBskyRichtextFacet } from "@atproto/api";
import type { ValidationResult } from "@atproto/lexicon";

export type Main = AppBskyRichtextFacet.Main;
export type Mention = AppBskyRichtextFacet.Mention;
export type Link = AppBskyRichtextFacet.Link;
export type Tag = AppBskyRichtextFacet.Tag;
export type ByteSlice = AppBskyRichtextFacet.ByteSlice;

export function isMain(v: unknown): v is Main {
  return typeof v === "object" && v !== null;
}

export function validateMain(v: unknown): ValidationResult<Main> {
  return { success: true, value: v as Main };
}
