/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as ComAtprotoRepoStrongRef from '../../../../../com/atproto/repo/strongRef'
import * as FmTealAlphaFeedSocialDefs from './defs'

export interface Record {
  subject: ComAtprotoRepoStrongRef.Main
  /** Client-declared timestamp when this playlist item was originally created. */
  createdAt: string
  track: FmTealAlphaFeedSocialDefs.TrackView
  /** The order of the track in the playlist. */
  order?: number
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.social.playlistItem#main' ||
      v.$type === 'fm.teal.alpha.feed.social.playlistItem')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.playlistItem#main', v)
}
