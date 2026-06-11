/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaActorDefs from '../actor/defs'

export interface ArtistView {
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name */
  name: string
  /** Total indexed listens for this artist */
  playCount: number
  albums: AlbumSummary[]
  [k: string]: unknown
}

export function isArtistView(v: unknown): v is ArtistView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.music.defs#artistView'
  )
}

export function validateArtistView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.music.defs#artistView', v)
}

export interface ArtistListenerView {
  actor: FmTealAlphaActorDefs.MiniProfileView
  /** Number of indexed listens by this actor for the artist */
  playCount: number
  [k: string]: unknown
}

export function isArtistListenerView(v: unknown): v is ArtistListenerView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.music.defs#artistListenerView'
  )
}

export function validateArtistListenerView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.music.defs#artistListenerView', v)
}

export interface AlbumView {
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  mbid: string
  /** Release title */
  name: string
  /** MusicBrainz ID URI for a representative release artist */
  artistMbid?: string
  /** Display name for the release artist */
  artistName: string
  /** Total indexed listens for tracks on this release */
  playCount: number
  tracks: TrackSummary[]
  [k: string]: unknown
}

export function isAlbumView(v: unknown): v is AlbumView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.music.defs#albumView'
  )
}

export function validateAlbumView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.music.defs#albumView', v)
}

export interface AlbumSummary {
  mbid: string
  name: string
  artistMbid?: string
  artistName: string
  playCount: number
  [k: string]: unknown
}

export function isAlbumSummary(v: unknown): v is AlbumSummary {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.music.defs#albumSummary'
  )
}

export function validateAlbumSummary(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.music.defs#albumSummary', v)
}

export interface TrackSummary {
  /** Representative listen URI for opening the track page */
  uri: string
  recordingMbid?: string
  name: string
  artistName: string
  playCount: number
  [k: string]: unknown
}

export function isTrackSummary(v: unknown): v is TrackSummary {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.music.defs#trackSummary'
  )
}

export function validateTrackSummary(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.music.defs#trackSummary', v)
}
