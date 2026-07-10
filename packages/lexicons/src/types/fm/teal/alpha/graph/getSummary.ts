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

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.graph.getSummary'

export type QueryParams = {
  /** The actor DID or handle. */
  actor: string
  /** Optional viewer DID for follow state. */
  viewer?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  followersCount: number
  followsCount: number
  /** Follow record URI if the viewer follows the actor. */
  viewerFollowing?: string
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
