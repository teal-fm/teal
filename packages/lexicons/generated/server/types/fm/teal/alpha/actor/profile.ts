/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet'

export interface Record {
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

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.actor.profile#main' ||
      v.$type === 'fm.teal.alpha.actor.profile')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.actor.profile#main', v)
}

export interface FeaturedItem {
  /** The Musicbrainz ID of the item */
  mbid: string
  /** The type of the item. Must be a valid Musicbrainz type, e.g. album, track, recording, etc. */
  type: string
  [k: string]: unknown
}

export function isFeaturedItem(v: unknown): v is FeaturedItem {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.actor.profile#featuredItem'
  )
}

export function validateFeaturedItem(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.actor.profile#featuredItem', v)
}
