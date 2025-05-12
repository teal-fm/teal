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
const id = 'fm.teal.alpha.feed.defs'

export interface PlayView {
  $type?: 'fm.teal.alpha.feed.defs#playView'
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
  /** The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if not provided. */
  musicServiceBaseDomain?: string
  /** A user-agent style string specifying the user agent. e.g. tealtracker/0.0.1b (Linux; Android 13; SM-A715F). Defaults to 'manual/unknown' if not provided. */
  submissionClientAgent?: string
  /** The unix timestamp of when the track was played */
  playedTime?: string
}

const hashPlayView = 'playView'

export function isPlayView<V>(v: V) {
  return is$typed(v, id, hashPlayView)
}

export function validatePlayView<V>(v: V) {
  return validate<PlayView & V>(v, id, hashPlayView)
}
