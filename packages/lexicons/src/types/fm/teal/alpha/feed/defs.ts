/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaActorDefs from '../actor/defs'

export interface PlayView {
  /** The AT URI for this play record */
  uri?: string
  /** The CID for this play record */
  cid?: string
  /** The DID of the account that authored this play */
  authorDid?: string
  author?: FmTealAlphaActorDefs.MiniProfileView
  /** The record key for this play */
  rkey?: string
  /** The name of the track */
  trackName: string
  /** The MusicBrainz ID URI of the track, formatted as mbid:<uuid> */
  trackMbId?: string
  /** The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid> */
  recordingMbId?: string
  /** The length of the track in seconds */
  duration?: number
  /** Array of artists in order of original appearance. */
  artists: Artist[]
  /** The name of the release/album */
  releaseName?: string
  /** The MusicBrainz release ID URI, formatted as mbid:<uuid> */
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
  [k: string]: unknown
}

export function isPlayView(v: unknown): v is PlayView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.feed.defs#playView'
  )
}

export function validatePlayView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.defs#playView', v)
}

export interface Artist {
  /** The name of the artist */
  artistName: string
  /** The MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  artistMbId?: string
  [k: string]: unknown
}

export function isArtist(v: unknown): v is Artist {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.feed.defs#artist'
  )
}

export function validateArtist(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.defs#artist', v)
}
