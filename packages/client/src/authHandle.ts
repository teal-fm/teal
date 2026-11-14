/** Use the same identity for lookup and OAuth, including pasted @handles. */
export function normalizeAuthHandle(value: string): string {
  return value.trim().replace(/^@+/, "").trim();
}
