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
import type * as FmTealMusicDefs from './defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.music.getArtistListeners'

export type QueryParams = {
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name fallback when no MusicBrainz ID is available */
  name?: string
  /** Time period for the leaderboard */
  period: 'all' | '30days' | '7days'
  /** Number of listeners to return */
  limit: number
  /** Pagination cursor */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  listeners: FmTealMusicDefs.ArtistListenerView[]
  /** Next page cursor */
  cursor?: string
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess
