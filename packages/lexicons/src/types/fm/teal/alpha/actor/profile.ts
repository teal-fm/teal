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
import type * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.actor.profile'

export interface Main {
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
  /** Default time period for profile listening statistics. */
  statsDefaultPeriod?:
    '7days' | '30days' | '90days' | '180days' | '365days' | 'all'
  createdAt?: string
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

export interface FeaturedItem {
  $type?: 'fm.teal.alpha.actor.profile#featuredItem'
  /** The MusicBrainz ID URI of the item, formatted as mbid:<uuid> */
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
