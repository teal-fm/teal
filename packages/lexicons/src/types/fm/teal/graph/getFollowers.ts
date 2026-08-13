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
const id = 'fm.teal.graph.getFollowers'

export type QueryParams = {
  /** The actor DID or handle. */
  actor: string
  limit: number
  cursor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  actors: FmTealActorDefs.MiniProfileView[]
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
