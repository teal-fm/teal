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
import type * as FmTealStatsDefs from './defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.stats.getRepoTopReleases'

export type QueryParams = {
  actor: string
  period: '7days' | '30days' | '90days' | '180days' | '365days' | 'all'
  limit: number
}
export type InputSchema = undefined

export interface OutputSchema {
  releases: FmTealStatsDefs.ReleaseView[]
  sourceCount: number
  albumPlayCount: number
  fetchedAt: string
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
