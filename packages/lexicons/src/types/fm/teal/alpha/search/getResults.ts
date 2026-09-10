/**
 * GENERATED CODE - DO NOT MODIFY
 */
import express from 'express'
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../lexicons'
import { isObj, hasProp } from '../../../../../util'
import { CID } from 'multiformats/cid'
import { HandlerAuth, HandlerPipeThrough } from '@atproto/xrpc-server'
import * as FmTealAlphaActorDefs from '../actor/defs'
import * as FmTealAlphaSearchDefs from './defs'
import * as FmTealAlphaStatsDefs from '../stats/defs'

export interface QueryParams {
  /** Search query */
  q: string
  /** Maximum results per category */
  limit: number
}

export type InputSchema = undefined

export interface OutputSchema {
  users: FmTealAlphaActorDefs.MiniProfileView[]
  songs: FmTealAlphaSearchDefs.SongResult[]
  artists: FmTealAlphaStatsDefs.ArtistView[]
  albums: FmTealAlphaStatsDefs.ReleaseView[]
  [k: string]: unknown
}

export type HandlerInput = undefined

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess | HandlerPipeThrough
export type HandlerReqCtx<HA extends HandlerAuth = never> = {
  auth: HA
  params: QueryParams
  input: HandlerInput
  req: express.Request
  res: express.Response
  resetRouteRateLimits: () => Promise<void>
}
export type Handler<HA extends HandlerAuth = never> = (
  ctx: HandlerReqCtx<HA>,
) => Promise<HandlerOutput> | HandlerOutput
