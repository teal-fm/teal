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
import type * as FmTealAlphaMusicDefs from './defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.music.getArtist'

export type QueryParams = {
  /** MusicBrainz artist ID URI, formatted as mbid:<uuid> */
  mbid?: string
  /** Artist name fallback when no MusicBrainz ID is available */
  name?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  artist: FmTealAlphaMusicDefs.ArtistView
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
