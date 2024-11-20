/// source referenced from the lovely bsky team <3
import {AtpAgent} from '@atproto/api'
import { downloadAndResize } from "../media/manip";
import {POST_IMG_MAX} from '../constants'
import {getLinkMeta} from '../link-meta/link-meta'
import {ComposerImage} from '../state/gallery'
import {createComposerImage} from '../state/gallery'

type ResolvedExternalLink = {
  type: 'external'
  uri: string
  title: string
  description: string
  thumb: ComposerImage | undefined
}

export type ResolvedLink =
  | ResolvedExternalLink

export class EmbeddingDisabledError extends Error {
  constructor() {
    super('Embedding is disabled for this record')
  }
}

export async function resolveLink(
  uri: string,
): Promise<ResolvedLink> {
  return resolveExternal(uri)
}

async function resolveExternal(
  uri: string,
): Promise<ResolvedExternalLink> {
  const result = await getLinkMeta(uri)
  console.log(`result: ${JSON.stringify(result, null, 2)}`)
  return {
    type: 'external',
    uri: result.url,
    title: result.title ?? '',
    description: result.description ?? '',
    thumb: result.image ? await imageToThumb(result.image) : undefined,
  }
}

async function imageToThumb(
  imageUri: string,
): Promise<ComposerImage | undefined> {
  try {
    console.log(imageUri)
    const img = await downloadAndResize({
      uri: imageUri,
      width: POST_IMG_MAX.width,
      height: POST_IMG_MAX.height,
      mode: 'contain',
      maxSize: POST_IMG_MAX.size,
      timeout: 15e3,
    })
    console.log(`img: ${JSON.stringify(img, null, 2)}`)
    if (img) {
      return await createComposerImage(img)
    }
  } catch {}
}