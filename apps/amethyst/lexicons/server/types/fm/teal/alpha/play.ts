/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../lexicons'
import { isObj, hasProp } from '../../../../util'
import { CID } from 'multiformats/cid'

export interface Record {
  /** The name of the track */
  trackName: string
  /** The Musicbrainz ID of the track */
  trackMbId?: string
  /** The Musicbrainz recording ID of the track */
  recordingMbId?: string
  /** The length of the track in seconds */
  duration?: number
  /** The name of the artist */
  artistName: string
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
  /** The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. */
  musicServiceBaseDomain?: string
  /** A user-agent style string specifying the user agent. e.g. tealtracker/0.0.1b */
  submissionClientAgent?: string
  /** The unix timestamp of when the track was played */
  playedTime?: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.play#main' || v.$type === 'fm.teal.alpha.play')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.play#main', v)
}
