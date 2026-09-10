/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../../util'
import type * as FmTealAlphaFeedDefs from '../defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.feed.social.defs'

export interface TrackView {
  $type?: 'fm.teal.alpha.feed.social.defs#trackView'
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
}

const hashTrackView = 'trackView'

export function isTrackView<V>(v: V) {
  return is$typed(v, id, hashTrackView)
}

export function validateTrackView<V>(v: V) {
  return validate<TrackView & V>(v, id, hashTrackView)
}

/** The category of badge. */
export type BadgeType =
  'verification' | 'listeningParty' | 'achievement' | (string & {})
