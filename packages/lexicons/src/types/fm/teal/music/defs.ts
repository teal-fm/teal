/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'
import type * as FmTealActorDefs from '../actor/defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.music.defs'

export interface ArtistView {
  $type?: 'fm.teal.music.defs#artistView'
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name */
  name: string
  /** Total indexed listens for this artist */
  playCount: number
  albums: AlbumSummary[]
}

const hashArtistView = 'artistView'

export function isArtistView<V>(v: V) {
  return is$typed(v, id, hashArtistView)
}

export function validateArtistView<V>(v: V) {
  return validate<ArtistView & V>(v, id, hashArtistView)
}

export interface ArtistListenerView {
  $type?: 'fm.teal.music.defs#artistListenerView'
  actor: FmTealActorDefs.MiniProfileView
  /** Number of indexed listens by this actor for the artist */
  playCount: number
}

const hashArtistListenerView = 'artistListenerView'

export function isArtistListenerView<V>(v: V) {
  return is$typed(v, id, hashArtistListenerView)
}

export function validateArtistListenerView<V>(v: V) {
  return validate<ArtistListenerView & V>(v, id, hashArtistListenerView)
}

export interface AlbumView {
  $type?: 'fm.teal.music.defs#albumView'
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  mbid: string
  /** Release title */
  name: string
  /** MusicBrainz ID URI for a representative release artist */
  artistMbid?: string
  /** Display name for the release artist */
  artistName: string
  /** Total indexed listens for tracks on this release */
  playCount: number
  tracks: TrackSummary[]
}

const hashAlbumView = 'albumView'

export function isAlbumView<V>(v: V) {
  return is$typed(v, id, hashAlbumView)
}

export function validateAlbumView<V>(v: V) {
  return validate<AlbumView & V>(v, id, hashAlbumView)
}

export interface AlbumSummary {
  $type?: 'fm.teal.music.defs#albumSummary'
  mbid: string
  name: string
  artistMbid?: string
  artistName: string
  playCount: number
  releaseType?: 'album' | 'single' | 'ep' | 'other' | (string & {})
}

const hashAlbumSummary = 'albumSummary'

export function isAlbumSummary<V>(v: V) {
  return is$typed(v, id, hashAlbumSummary)
}

export function validateAlbumSummary<V>(v: V) {
  return validate<AlbumSummary & V>(v, id, hashAlbumSummary)
}

export interface TrackSummary {
  $type?: 'fm.teal.music.defs#trackSummary'
  /** Representative listen URI for opening the track page */
  uri: string
  recordingMbid?: string
  name: string
  artistName: string
  playCount: number
}

const hashTrackSummary = 'trackSummary'

export function isTrackSummary<V>(v: V) {
  return is$typed(v, id, hashTrackSummary)
}

export function validateTrackSummary<V>(v: V) {
  return validate<TrackSummary & V>(v, id, hashTrackSummary)
}
