/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaFeedDefs from '../defs'

export interface TrackView {
  /** The name of the track. */
  trackName: string
  /** The MusicBrainz ID URI of the track, formatted as mbid:<uuid>. */
  trackMbId?: string
  /** The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid>. */
  recordingMbId?: string
  /** The length of the track in seconds. */
  duration?: number
  /** Array of artist names in order of original appearance. Prefer using 'artists'. */
  artistNames?: string[]
  /** DEPRECATED: USE 'artists' INSTEAD. Array of Musicbrainz artist IDs. */
  artistMbIds?: string[]
  /** Array of artists in order of original appearance. */
  artists?: FmTealAlphaFeedDefs.Artist[]
  /** The name of the release or album. */
  releaseName?: string
  /** The MusicBrainz release ID URI, formatted as mbid:<uuid>. */
  releaseMbId?: string
  /** The ISRC code associated with the recording. */
  isrc?: string
  /** Distinguishing information for track variants. */
  trackDiscriminant?: string
  /** Distinguishing information for release variants. */
  releaseDiscriminant?: string
  /** The URL associated with this track. */
  originUrl?: string
  [k: string]: unknown
}

export function isTrackView(v: unknown): v is TrackView {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.feed.social.defs#trackView'
  )
}

export function validateTrackView(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.defs#trackView', v)
}

/** The category of badge. */
export type BadgeType =
  | 'verification'
  | 'listeningParty'
  | 'achievement'
  | (string & {})
