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
  /** The MusicBrainz ID URI of the track, formatted as mbid:<uuid> */
  trackMbId?: string
  /** The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid> */
  recordingMbId?: string
  /** The length of the track in seconds */
  duration?: number
  /** DEPRECATED: USE 'artists' INSTEAD. Array of artist names in order of original appearance. */
  artistNames?: string[]
  /** DEPRECATED: USE 'artists' INSTEAD. Array of Musicbrainz artist IDs. */
  artistMbIds?: string[]
  /** Array of artists in order of original appearance. */
  artists?: FmTealAlphaFeedDefs.Artist[]
  /** The name of the release/album */
  releaseName?: string
  /** The MusicBrainz release ID URI, formatted as mbid:<uuid> */
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
  /** Distinguishing information for track variants (e.g. 'Acoustic Version', 'Live at Wembley', 'Radio Edit', 'Demo'). Used to differentiate between different versions of the same base track while maintaining grouping capabilities. */
  trackDiscriminant?: string
  /** Distinguishing information for release variants (e.g. 'Deluxe Edition', 'Remastered', '2023 Remaster', 'Special Edition'). Used to differentiate between different versions of the same base release while maintaining grouping capabilities. */
  releaseDiscriminant?: string
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
