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
import type * as AppBskyRichtextFacet from '../../../../app/bsky/richtext/facet'

const is$typed = _is$typed,
  validate = _validate
const id = 'fm.teal.alpha.richtext.facet'

/** Annotation of a sub-string within rich text. */
export interface Main {
  $type?: 'fm.teal.alpha.richtext.facet'
  index: AppBskyRichtextFacet.ByteSlice
  features: (
    | $Typed<AppBskyRichtextFacet.Mention>
    | $Typed<AppBskyRichtextFacet.Link>
    | { $type: string }
  )[]
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain)
}
