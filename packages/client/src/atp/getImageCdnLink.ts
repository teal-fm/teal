const DEFAULT_IMAGE_TEMPLATE = "https://at.uwu.wang/{did}/{hash}";

export default function getImageCdnLink({
  did,
  hash,
}: {
  did: string;
  hash: string;
}): string | undefined {
  if (!did || !hash) return undefined;
  // if hash is actually a data url return it
  if (hash.startsWith("data:")) return hash;
  return DEFAULT_IMAGE_TEMPLATE.replace("{did}", did).replace("{hash}", hash);
}
