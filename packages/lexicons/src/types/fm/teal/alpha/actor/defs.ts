/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet'
import * as FmTealAlphaActorProfile from './profile'

export interface ProfileView {
  /** The decentralized identifier of the actor */
  did?: string
  displayName?: string
  /** Free-form profile description text. */
  description?: string
  /** Annotations of text in the profile description (mentions, URLs, hashtags, etc). May be changed to another (backwards compatible) lexicon. */
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  featuredItem?: FmTealAlphaActorProfile.FeaturedItem
  /** IPLD of the avatar */
  avatar?: string
  /** IPLD of the banner image */
  banner?: string
  createdAt?: string
  [k: string]: unknown
}

export function isProfileView(v: unknown): v is ProfileView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.actor.defs#profileView'
  )
}

export function validateProfileView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.actor.defs#profileView', v)
}

export interface MiniProfileView {
  /** The decentralized identifier of the actor */
  did?: string
  displayName?: string
  handle?: string
  /** IPLD of the avatar */
  avatar?: string
  [k: string]: unknown
}

export function isMiniProfileView(v: unknown): v is MiniProfileView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.actor.defs#miniProfileView'
  )
}

export function validateMiniProfileView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.actor.defs#miniProfileView', v)
}
