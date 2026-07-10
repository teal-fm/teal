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
import type * as FmTealAlphaFeedDefs from '../feed/defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.music.getAlbum'

export type QueryParams = {
  /** MusicBrainz release ID URI, formatted as mbid:<uuid> */
  mbid: string
  limit: number
  /** Opaque cursor for the next page of listens */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  album: FmTealAlphaMusicDefs.AlbumView
  plays: FmTealAlphaFeedDefs.PlayView[]
  /** Opaque cursor for the next page of listens */
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
