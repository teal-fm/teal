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
import type * as FmTealAlphaActorProfile from './profile.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.actor.defs'

export interface ProfileView {
  $type?: 'fm.teal.alpha.actor.defs#profileView'
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
}

const hashProfileView = 'profileView'

export function isProfileView<V>(v: V) {
  return is$typed(v, id, hashProfileView)
}

export function validateProfileView<V>(v: V) {
  return validate<ProfileView & V>(v, id, hashProfileView)
}

export interface MiniProfileView {
  $type?: 'fm.teal.alpha.actor.defs#miniProfileView'
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

export interface AlbumView {
  $type?: 'fm.teal.alpha.actor.defs#albumView'
  /** The name of the album */
  albumName: string
  /** The artist of the album */
  albumArtist: string
  /** The URL of the album art */
  albumArt?: string
  /** The MusicBrainz ID of the album */
  albumReleaseMBID?: string
}

const hashAlbumView = 'albumView'

export function isAlbumView<V>(v: V) {
  return is$typed(v, id, hashAlbumView)
}

export function validateAlbumView<V>(v: V) {
  return validate<AlbumView & V>(v, id, hashAlbumView)
}
