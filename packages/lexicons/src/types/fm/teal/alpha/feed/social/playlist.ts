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

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.feed.social.playlist'

export interface Main {
  $type: 'fm.teal.alpha.feed.social.playlist'
  /** Display name for the playlist, required. */
  name: string
  /** Free-form playlist description text. */
  description?: string
  /** Annotations of text in the playlist description. */
  descriptionFacets?: FmTealAlphaRichtextFacet.Main[]
  /** DIDs of actors who can author playlist items for this playlist. Include the playlist record author. Appviews may attribute playlist items to this playlist when the item's repo author appears in this list. */
  authors: string[]
  /** Optional image displayed for the playlist. */
  cover?: BlobRef
  /** Client-declared timestamp when this playlist was originally created. */
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
