/** Bridge SDK BlobRef instances and public JSON to generated plain IPLD values. */
export function profileRecordBlob(
  value: unknown,
  decodeJson: (value: unknown) => unknown,
): unknown {
  const sdk = value as { ipld?: () => unknown } | undefined;
  if (typeof sdk?.ipld === "function") return sdk.ipld();
  const json = value as
    { $type?: unknown; ref?: { $link?: unknown } } | undefined;
  if (json?.$type === "blob" && typeof json.ref?.$link === "string") {
    const decoded = decodeJson(value) as { ipld?: () => unknown };
    if (typeof decoded?.ipld === "function") return decoded.ipld();
  }
  // Already-decoded values (including retained legacy refs) are validated by
  // the generated profile schema rather than guessed or rebuilt here.
  return value;
}
