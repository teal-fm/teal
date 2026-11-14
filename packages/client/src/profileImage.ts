const MAX_PROFILE_IMAGE_BYTES = 1_000_000;

/** Profile images follow the lexicon: PNG/JPEG, at most one megabyte. */
export async function prepareProfileImage(blob: Blob): Promise<{
  blob: Blob;
  encoding: "image/png" | "image/jpeg";
}> {
  if (!blob.size) throw new Error("The image is empty. Choose another image.");
  if (blob.size > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error("Choose a PNG or JPEG image smaller than 1 MB.");
  }
  let encoding = blob.type.split(";")[0].toLowerCase();
  if (!encoding || encoding === "application/octet-stream") {
    const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    ) {
      encoding = "image/png";
    } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      encoding = "image/jpeg";
    }
  }
  if (encoding !== "image/png" && encoding !== "image/jpeg") {
    throw new Error(
      "Choose a PNG or JPEG image. This image format isn't supported.",
    );
  }
  return {
    blob: blob.type === encoding ? blob : new Blob([blob], { type: encoding }),
    encoding,
  };
}
