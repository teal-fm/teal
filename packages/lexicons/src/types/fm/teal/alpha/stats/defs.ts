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

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.stats.defs'

export interface ArtistView {
  $type?: 'fm.teal.alpha.stats.defs#artistView'
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name */
  name?: string
  /** Total number of plays for this artist */
  playCount?: number
}

const hashArtistView = 'artistView'

export function isArtistView<V>(v: V) {
  return is$typed(v, id, hashArtistView)
}

export function validateArtistView<V>(v: V) {
  return validate<ArtistView & V>(v, id, hashArtistView)
}

export interface ReleaseView {
  $type?: 'fm.teal.alpha.stats.defs#releaseView'
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Release/album name */
  name?: string
  /** Total number of plays for this release */
  playCount?: number
}

const hashReleaseView = 'releaseView'

export function isReleaseView<V>(v: V) {
  return is$typed(v, id, hashReleaseView)
}

export function validateReleaseView<V>(v: V) {
  return validate<ReleaseView & V>(v, id, hashReleaseView)
}

export interface RecordingView {
  $type?: 'fm.teal.alpha.stats.defs#recordingView'
  /** MusicBrainz recording ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Recording/track name */
  name?: string
  /** Total number of plays for this recording */
  playCount?: number
}

const hashRecordingView = 'recordingView'

export function isRecordingView<V>(v: V) {
  return is$typed(v, id, hashRecordingView)
}

export function validateRecordingView<V>(v: V) {
  return validate<RecordingView & V>(v, id, hashRecordingView)
}
