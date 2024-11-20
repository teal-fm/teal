import { randomUUID } from "crypto"

export type ImageMeta = {
  path: string
  width: number
  height: number
  mime: string
}

export type ImageSource = ImageMeta & {
  id: string
}

type ComposerImageBase = {
  alt: string
  source: ImageSource
}
type ComposerImageWithoutTransformation = ComposerImageBase & {
  transformed?: undefined
  manips?: undefined
}
type ComposerImageWithTransformation = ComposerImageBase & {
  transformed: ImageMeta
}

export type ComposerImage =
  | ComposerImageWithoutTransformation
  | ComposerImageWithTransformation

export async function createComposerImage(
  raw: ImageMeta,
): Promise<ComposerImageWithoutTransformation> {
  return {
    alt: '',
    source: {
      id: randomUUID(),
      path: raw.path,
      width: raw.width,
      height: raw.height,
      mime: raw.mime,
    },
  }
}