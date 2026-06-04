/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'

export interface SongResult {
  /** Representative indexed play URI for this song */
  uri: string
  /** Track name */
  trackName: string
  /** Display-ready artist credit */
  artistName: string
  /** Release or album name */
  releaseName?: string
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  releaseMbId?: string
  /** Number of indexed plays for this song */
  playCount: number
  [k: string]: unknown
}

export function isSongResult(v: unknown): v is SongResult {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.search.defs#songResult'
  )
}

export function validateSongResult(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.search.defs#songResult', v)
}
