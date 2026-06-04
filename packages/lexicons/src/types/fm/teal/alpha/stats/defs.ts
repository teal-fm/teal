/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'

export interface ArtistView {
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name */
  name?: string
  /** Total number of plays for this artist */
  playCount?: number
  [k: string]: unknown
}

export function isArtistView(v: unknown): v is ArtistView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.stats.defs#artistView'
  )
}

export function validateArtistView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.stats.defs#artistView', v)
}

export interface ReleaseView {
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Release/album name */
  name?: string
  /** Total number of plays for this release */
  playCount?: number
  [k: string]: unknown
}

export function isReleaseView(v: unknown): v is ReleaseView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.stats.defs#releaseView'
  )
}

export function validateReleaseView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.stats.defs#releaseView', v)
}

export interface RecordingView {
  /** MusicBrainz recording ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Recording/track name */
  name?: string
  /** Total number of plays for this recording */
  playCount?: number
  [k: string]: unknown
}

export function isRecordingView(v: unknown): v is RecordingView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.stats.defs#recordingView'
  )
}

export function validateRecordingView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.stats.defs#recordingView', v)
}
