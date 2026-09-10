/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet'

/** Annotation of a sub-string within rich text. */
export interface Main {
  index: AppBskyRichtextFacet.ByteSlice
  features: (
    | AppBskyRichtextFacet.Mention
    | AppBskyRichtextFacet.Link
    | { $type: string; [k: string]: unknown }
  )[]
  [k: string]: unknown
}

export function isMain(v: unknown): v is Main {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.richtext.facet#main' ||
      v.$type === 'fm.teal.alpha.richtext.facet')
  )
}

export function validateMain(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.richtext.facet#main', v)
}
