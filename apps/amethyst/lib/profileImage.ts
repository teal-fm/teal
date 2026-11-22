import type { ImagePickerAsset, launchImageLibraryAsync } from "expo-image-picker";

export type SelectedProfileImage = Pick<
  ImagePickerAsset,
  "uri" | "mimeType" | "file" | "fileSize"
>;

export type ProfileImageSlot = "avatar" | "banner";

export async function pickProfileImage(
  launchPicker: typeof launchImageLibraryAsync,
  slot: ProfileImageSlot,
): Promise<SelectedProfileImage | undefined> {
  const result = await launchPicker({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: slot === "avatar" ? [1, 1] : [3, 1],
    quality: 1,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  const size = asset.file?.size ?? asset.fileSize;
  if (size !== undefined) validateProfileImageSize(size);
  return asset;
}

export function validateProfileImageSize(size: number) {
  if (!size) throw new Error("The selected image is empty.");
  if (size > 1_000_000)
    throw new Error("Choose a profile image of 1 MB or less.");
}

async function readImage(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Couldn't read the selected image.");
  return response.blob();
}

export async function uploadProfileImage<T>(
  agent: {
    uploadBlob: (
      blob: Blob,
      options: { encoding: string },
    ) => Promise<{ data: { blob: T } }>;
  },
  image: SelectedProfileImage,
) {
  const blob = image.file ?? (await readImage(image.uri));
  validateProfileImageSize(blob.size);

  let encoding = blob.type.toLowerCase().split(";")[0].trim();
  if (!encoding || encoding === "application/octet-stream") {
    encoding = image.mimeType?.toLowerCase() ?? "";
  }
  if (!encoding || encoding === "application/octet-stream") {
    // Native file URIs sometimes carry no MIME type. Read just the signature.
    const bytes = new Uint8Array(
      await new Response(blob.slice(0, 8)).arrayBuffer(),
    );
    if (
      [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
    ) {
      encoding = "image/png";
    } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      encoding = "image/jpeg";
    }
  }
  if (encoding !== "image/png" && encoding !== "image/jpeg") {
    throw new Error("Choose a PNG or JPEG profile image.");
  }

  return (await agent.uploadBlob(blob, { encoding })).data.blob;
}
