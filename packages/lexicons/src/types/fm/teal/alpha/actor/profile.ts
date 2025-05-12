/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../util'
import type * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.actor.profile'

export interface Record {
  $type: 'fm.teal.alpha.actor.profile'
  displayName?: string
  /** Free-form profile description text. */
  description?: string
  /** Annotations of text in the profile description (mentions, URLs, hashtags, etc). */
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  featuredItem?: FeaturedItem
  /** Small image to be displayed next to posts from account. AKA, 'profile picture' */
  avatar?: BlobRef
  /** Larger horizontal image to display behind profile view. */
  banner?: BlobRef
  createdAt?: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}

export interface FeaturedItem {
  $type?: 'fm.teal.alpha.actor.profile#featuredItem'
  /** The Musicbrainz ID of the item */
  mbid: string
  /** The type of the item. Must be a valid Musicbrainz type, e.g. album, track, recording, etc. */
  type: string
}

const hashFeaturedItem = 'featuredItem'

export function isFeaturedItem<V>(v: V) {
  return is$typed(v, id, hashFeaturedItem)
}

export function validateFeaturedItem<V>(v: V) {
  return validate<FeaturedItem & V>(v, id, hashFeaturedItem)
}
