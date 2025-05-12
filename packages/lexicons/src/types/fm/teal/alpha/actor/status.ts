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
import type * as FmTealAlphaFeedDefs from '../feed/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.actor.status'

export interface Record {
  $type: 'fm.teal.alpha.actor.status'
  /** The unix timestamp of when the item was recorded */
  time: string
  /** The unix timestamp of the expiry time of the item. If unavailable, default to 10 minutes past the start time. */
  expiry?: string
  item: FmTealAlphaFeedDefs.PlayView
  [k: string]: unknown
}

const hashRecord = 'main'

export function isRecord<V>(v: V) {
  return is$typed(v, id, hashRecord)
}

export function validateRecord<V>(v: V) {
  return validate<Record & V>(v, id, hashRecord, true)
}
