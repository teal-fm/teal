/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../../../../../com/atproto/repo/strongRef'

export interface Record {
  badge: ComAtprotoRepoStrongRef.Main
  /** DID of the actor receiving the badge. */
  assignee: string
  /** DID of the actor assigning the badge. */
  assigner: string
  /** Client-declared timestamp when this badge assignment was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.social.badgeAssignment#main' ||
      v.$type === 'fm.teal.alpha.feed.social.badgeAssignment')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.badgeAssignment#main', v)
}
