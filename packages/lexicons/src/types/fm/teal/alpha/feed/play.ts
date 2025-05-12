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
const id = 'fm.teal.alpha.feed.play'

export interface Record {
  $type: 'fm.teal.alpha.feed.play'
  /** The name of the track */
  trackName: string
  /** The Musicbrainz ID of the track */
  trackMbId?: string
  /** The Musicbrainz recording ID of the track */
  recordingMbId?: string
  /** The length of the track in seconds */
  duration?: number
  /** Array of artist names in order of original appearance. */
  artistNames: string[]
  /** Array of Musicbrainz artist IDs */
  artistMbIds?: string[]
  /** The name of the release/album */
  releaseName?: string
  /** The Musicbrainz release ID */
  releaseMbId?: string
  /** The ISRC code associated with the recording */
  isrc?: string
  /** The URL associated with this track */
  originUrl?: string
  /** The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if unavailable or not provided. */
  musicServiceBaseDomain?: string
  /** A metadata string specifying the user agent where the format is `<app-identifier>/<version> (<kernel/OS-base>; <platform/OS-version>; <device-model>)`. If string is provided, only `app-identifier` and `version` are required. `app-identifier` is recommended to be in reverse dns format. Defaults to 'manual/unknown' if unavailable or not provided. */
  submissionClientAgent?: string
  /** The unix timestamp of when the track was played */
  playedTime?: string
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
