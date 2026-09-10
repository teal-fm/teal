/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaRichtextFacet from '../../richtext/facet'

export interface Record {
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

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.social.playlist#main' ||
      v.$type === 'fm.teal.alpha.feed.social.playlist')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.playlist#main', v)
}
