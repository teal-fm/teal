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
import type * as FmTealAlphaFeedDefs from './defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.feed.getActorFeed'

export type QueryParams = {
  /** The author's DID for the play */
  authorDID: string
  /** The cursor to start the query from */
  cursor?: string
  /** The upper limit of tracks to get per request. Default is 20, max is 50. */
  limit?: number
}
export type InputSchema = undefined

export interface OutputSchema {
  plays: FmTealAlphaFeedDefs.PlayView[]
  /** Opaque cursor for the next page of plays */
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
