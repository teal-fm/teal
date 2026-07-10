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
const id = 'fm.teal.alpha.search.defs'

export interface SongResult {
  $type?: 'fm.teal.alpha.search.defs#songResult'
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
}

const hashSongResult = 'songResult'

export function isSongResult<V>(v: V) {
  return is$typed(v, id, hashSongResult)
}

export function validateSongResult<V>(v: V) {
  return validate<SongResult & V>(v, id, hashSongResult)
}
