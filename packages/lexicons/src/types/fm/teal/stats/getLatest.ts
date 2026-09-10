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
import type * as FmTealFeedDefs from '../feed/defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.stats.getLatest'

export type QueryParams = {
  /** Number of latest plays to return */
  limit: number
  /** Opaque cursor for the next page of plays */
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  plays: FmTealFeedDefs.PlayView[]
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
