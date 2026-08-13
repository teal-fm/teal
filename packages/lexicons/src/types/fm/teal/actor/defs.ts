/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet'
import type * as FmTealActorProfile from './profile'
import type * as FmTealActorProfileStatus from './profileStatus'
import type * as FmTealFeedDefs from '../feed/defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.actor.defs'

export interface ProfileView {
  $type?: 'fm.teal.actor.defs#profileView'
  /** The decentralized identifier of the actor */
  did?: string
  displayName?: string
  /** Free-form profile description text. */
  description?: string
  /** Annotations of text in the profile description (mentions, URLs, hashtags, etc). May be changed to another (backwards compatible) lexicon. */
  descriptionFacets?: AppBskyRichtextFacet.Main[]
  featuredItem?: FmTealActorProfile.FeaturedItem
  /** IPLD of the avatar */
  avatar?: string
  /** IPLD of the banner image */
  banner?: string
  status?: StatusView
  profileStatus?: FmTealActorProfileStatus.Record
  /** Default time period for profile listening statistics. */
  statsDefaultPeriod?:
    '7days' | '30days' | '90days' | '180days' | '365days' | 'all'
  createdAt?: string
}

const hashProfileView = 'profileView'

export function isProfileView<V>(v: V) {
  return is$typed(v, id, hashProfileView)
}

export function validateProfileView<V>(v: V) {
  return validate<ProfileView & V>(v, id, hashProfileView)
}

export interface MiniProfileView {
  $type?: 'fm.teal.actor.defs#miniProfileView'
  /** The decentralized identifier of the actor */
  did?: string
  displayName?: string
  handle?: string
  /** IPLD of the avatar */
  avatar?: string
}

const hashMiniProfileView = 'miniProfileView'

export function isMiniProfileView<V>(v: V) {
  return is$typed(v, id, hashMiniProfileView)
}

export function validateMiniProfileView<V>(v: V) {
  return validate<MiniProfileView & V>(v, id, hashMiniProfileView)
}

/** A declaration of the status of the actor. */
export interface StatusView {
  $type?: 'fm.teal.actor.defs#statusView'
  /** The datetime at which the status was recorded. */
  time?: string
  /** The datetime after which the status is no longer current. */
  expiry?: string
  item?: FmTealFeedDefs.PlayView
}

const hashStatusView = 'statusView'

export function isStatusView<V>(v: V) {
  return is$typed(v, id, hashStatusView)
}

export function validateStatusView<V>(v: V) {
  return validate<StatusView & V>(v, id, hashStatusView)
}
