/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { lexicons } from '../../../../../../lexicons'
import { isObj, hasProp } from '../../../../../../util'
import { CID } from 'multiformats/cid'
import * as FmTealAlphaFeedSocialDefs from './defs'
import * as FmTealAlphaRichtextFacet from '../../richtext/facet'
import * as ComAtprotoRepoStrongRef from '../../../../../com/atproto/repo/strongRef'

export interface Record {
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  track: FmTealAlphaFeedSocialDefs.TrackView
  reply?: ReplyRef
  /** Rich text facets, which may include mentions, links, and other features. */
  facets?: FmTealAlphaRichtextFacet.Main[]
  /** Indicates human language of post primary text content. */
  langs?: string[]
  /** Additional hashtags, in addition to any included in post text and facets. */
  tags?: string[]
  /** Client-declared timestamp when this post was originally created. */
  createdAt: string
  [k: string]: unknown
}

export function isRecord(v: unknown): v is Record {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    (v.$type === 'fm.teal.alpha.feed.social.post#main' ||
      v.$type === 'fm.teal.alpha.feed.social.post')
  )
}

export function validateRecord(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.post#main', v)
}

export interface ReplyRef {
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
  [k: string]: unknown
}

export function isReplyRef(v: unknown): v is ReplyRef {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'fm.teal.alpha.feed.social.post#replyRef'
  )
}

export function validateReplyRef(v: unknown): ValidationResult {
  return lexicons.validate('fm.teal.alpha.feed.social.post#replyRef', v)
}
