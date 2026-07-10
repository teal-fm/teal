/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../../util'
import type * as FmTealAlphaRichtextFacet from '../../richtext/facet'
import type * as FmTealAlphaFeedSocialDefs from './defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.feed.social.badge'

export interface Main {
  $type: 'fm.teal.alpha.feed.social.badge'
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

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}
