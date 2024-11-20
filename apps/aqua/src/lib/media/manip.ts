/// source referenced from the lovely bsky team <3
import {Image as RNImage} from 'react-native-image-crop-picker'


export interface Dimensions {
  width: number
  height: number
}

// Fairly accurate estimate that is more performant
// than decoding and checking length of URI
export function getDataUriSize(uri: string): number {
  return Math.round((uri.length * 3) / 4)
}

export function isUriImage(uri: string) {
  return /\.(jpg|jpeg|png).*$/.test(uri)
}

export function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        console.log("failed to read blob");
        reject(new Error('Failed to read blob'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}


export async function compressIfNeeded(
  img: RNImage,
  maxSize: number,
): Promise<RNImage> {
  if (img.size < maxSize) {
    return img
  }
  return await doResize(img.path, {
    width: img.width,
    height: img.height,
    mode: 'stretch',
    maxSize,
  })
}

export interface DownloadAndResizeOpts {
  uri: string
  width: number
  height: number
  mode: 'contain' | 'cover' | 'stretch'
  maxSize: number
  timeout: number
}

export async function downloadAndResize(opts: DownloadAndResizeOpts) {
  // const conltroller = new AbortController()
  // const to = setTimeout(() => controller.abort(), opts.timeout || 5e3)
  console.log(`dl&rs: ${opts.uri}`)
  const headers = new Headers();
  headers.append("Host", "cardyb.bsky.app");
  headers.append("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/jxl,image/webp,image/png,image/svg+xml,*/*;q=0.8",);
  headers.append("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0");
  headers.append("Accept-Language", "en-US,en;q=0.5");
  headers.append("Accept-Encoding", "gzip, deflate, br, zstd");
  headers.append("Sec-GPC", "1");
  headers.append("Connection", "keep-alive");
  headers.append("Upgrade-Insecure-Requests", "1");
  headers.append("Sec-Fetch-Dest", "document");
  headers.append("Sec-Fetch-Mode", "navigate");
  headers.append("Sec-Fetch-Site", "none");
  headers.append("Sec-Fetch-User", "?1");
  headers.append("Priority", "u=0, i");
  headers.append("TE", "trailers",);

  console.log(`headers: ${JSON.stringify(Object.fromEntries(headers.entries()), null, 2)}`)

  const res = await fetch(opts.uri, {
    method: "GET",
    headers: headers
  })
  if (res.status != 200) {
    console.log(`fetch didnt 200`);
    return;
  } else {
    console.log('did 200')
    console.log(`await: ${await res.json()}`)
  }
  // const resJson = await res.json();
  // console.log(`res: ${resJson}`);
  const resBody = await res.blob()
  console.log(`sanity: ${resBody}`)

  // clearTimeout(to)

  const dataUri = await blobToDataUri(resBody)
  console.log(`dataUri: ${dataUri}`);
  return await doResize(dataUri, opts)
}

export async function shareImageModal(_opts: {uri: string}) {
  // TODO
  throw new Error('TODO')
}

export async function saveImageToAlbum(_opts: {uri: string; album: string}) {
  // TODO
  throw new Error('TODO')
}

export async function getImageDim(path: string): Promise<Dimensions> {
  var img = document.createElement('img')
  const promise = new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
  })
  img.src = path
  await promise
  return {width: img.width, height: img.height}
}

// internal methods
// =

interface DoResizeOpts {
  width: number
  height: number
  mode: 'contain' | 'cover' | 'stretch'
  maxSize: number
}

async function doResize(dataUri: string, opts: DoResizeOpts): Promise<RNImage> {
  let newDataUri

  for (let i = 0; i <= 10; i++) {
    newDataUri = await createResizedImage(dataUri, {
      width: opts.width,
      height: opts.height,
      quality: 1 - i * 0.1,
      mode: opts.mode,
    })
    console.log(`resize: ${newDataUri}`);
    if (getDataUriSize(newDataUri) < opts.maxSize) {
      break
    }
  }
  if (!newDataUri) {
    throw new Error('Failed to compress image')
  }
  return {
    path: newDataUri,
    mime: 'image/jpeg',
    size: getDataUriSize(newDataUri),
    width: opts.width,
    height: opts.height,
  }
}

function createResizedImage(
  dataUri: string,
  {
    width,
    height,
    quality,
    mode,
  }: {
    width: number
    height: number
    quality: number
    mode: 'contain' | 'cover' | 'stretch'
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return reject(new Error('Failed to resize image'))
      }

      let scale = 1
      if (mode === 'cover') {
        scale = img.width < img.height ? width / img.width : height / img.height
      } else if (mode === 'contain') {
        scale = img.width > img.height ? width / img.width : height / img.height
      }
      let w = img.width * scale
      let h = img.height * scale

      canvas.width = w
      canvas.height = h

      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    })
    img.addEventListener('error', ev => {
      reject(ev.error)
    })
    img.src = dataUri
  })
}

export async function saveBytesToDisk(
  filename: string,
  bytes: Uint8Array,
  type: string,
) {
  const blob = new Blob([bytes], {type})
  const url = URL.createObjectURL(blob)
  await downloadUrl(url, filename)
  // Firefox requires a small delay
  setTimeout(() => URL.revokeObjectURL(url), 100)
  return true
}

async function downloadUrl(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export async function safeDeleteAsync() {
  // no-op
}