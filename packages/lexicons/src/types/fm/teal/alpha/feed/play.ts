/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaFeedDefs from './defs'

export interface Record {
  /** The name of the track */
  trackName: string
  /** The Musicbrainz ID of the track */
  trackMbId?: string
  /** The Musicbrainz recording ID of the track */
  recordingMbId?: string
  /** The length of the track in seconds */
  duration?: number
  /** Array of artist names in order of original appearance. Prefer using 'artists'. */
  artistNames?: string[]
  /** Array of Musicbrainz artist IDs. Prefer using 'artists'. */
  artistMbIds?: string[]
  /** Array of artists in order of original appearance. */
  artists?: FmTealAlphaFeedDefs.Artist[]
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

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.play#main' ||
      v.$type === 'fm.teal.alpha.feed.play')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.play#main', v)
}
