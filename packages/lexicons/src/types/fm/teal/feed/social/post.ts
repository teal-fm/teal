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
import type * as FmTealRichtextFacet from '../../richtext/facet'
import type * as ComAtprotoRepoStrongRef from '../../../../com/atproto/repo/strongRef'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.feed.social.post'

export interface Main {
  $type: 'fm.teal.feed.social.post'
  /** The primary post content. May be an empty string, if there are embeds. */
  text: string
  /** The name of the track */
  trackName?: string
  /** The Musicbrainz ID of the track */
  trackMbId?: string
  /** The Musicbrainz recording ID of the track */
  recordingMbId?: string
  /** The duration of the track in seconds */
  duration?: number
  /** The names of the artists */
  artistNames?: string[]
  /** The Musicbrainz IDs of the artists */
  artistMbIds?: string[]
  /** The name of the release/album */
  releaseName?: string
  /** The Musicbrainz ID of the release/album */
  releaseMbId?: string
  /** The ISRC code associated with the recording */
  isrc?: string
  reply?: ReplyRef
  /** Rich text facets, which may include mentions, links, and other features. */
  facets?: FmTealRichtextFacet.Main[]
  /** Indicates human language of post primary text content. */
  langs?: string[]
  /** Additional hashtags, in addition to any included in post text and facets. */
  tags?: string[]
  /** Client-declared timestamp when this post was originally created. */
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

export interface ReplyRef {
  $type?: 'fm.teal.feed.social.post#replyRef'
  root: ComAtprotoRepoStrongRef.Main
  parent: ComAtprotoRepoStrongRef.Main
}

const hashReplyRef = 'replyRef'

export function isReplyRef<V>(v: V) {
  return is$typed(v, id, hashReplyRef)
}

export function validateReplyRef<V>(v: V) {
  return validate<ReplyRef & V>(v, id, hashReplyRef)
}
