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
import type * as FmTealAlphaActorDefs from '../actor/defs'
import type * as FmTealAlphaSearchDefs from './defs'
import type * as FmTealAlphaStatsDefs from '../stats/defs'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.search.getResults'

export type QueryParams = {
  /** Search query */
  q: string
  /** Maximum results per category */
  limit: number
  /** Only return music listened to by this actor */
  actor?: string
}
export type InputSchema = undefined

export interface OutputSchema {
  users: FmTealAlphaActorDefs.MiniProfileView[]
  songs: FmTealAlphaSearchDefs.SongResult[]
  artists: FmTealAlphaStatsDefs.ArtistView[]
  albums: FmTealAlphaStatsDefs.ReleaseView[]
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
