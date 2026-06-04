/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaRichtextFacet from '../../richtext/facet'
import * as FmTealAlphaFeedSocialDefs from './defs'

export interface Record {
  /** Display name for the badge. */
  name: string
  /** Description of what the badge represents. */
  description: string
  /** Annotations of text in the badge description. */
  descriptionFacets?: FmTealAlphaRichtextFacet.Main[]
  /** Image displayed for the badge. */
  image: BlobRef
  /** DID of the actor who created this badge definition. */
  creator: string
  type: FmTealAlphaFeedSocialDefs.BadgeType
  /** Client-declared timestamp when this badge was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.social.badge#main' ||
      v.$type === 'fm.teal.alpha.feed.social.badge')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.badge#main', v)
}
