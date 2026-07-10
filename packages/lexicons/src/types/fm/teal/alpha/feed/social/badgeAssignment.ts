/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../../../util'
import type * as ComAtprotoRepoStrongRef from '../../../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.feed.social.badgeAssignment'

export interface Main {
  $type: 'fm.teal.alpha.feed.social.badgeAssignment'
  badge: ComAtprotoRepoStrongRef.Main
  /** DID of the actor receiving the badge. */
  assignee: string
  /** DID of the actor assigning the badge. */
  assigner: string
  /** Client-declared timestamp when this badge assignment was originally created. */
  createdAt: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}
