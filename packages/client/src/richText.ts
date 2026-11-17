import type { RichTextFacet } from "./teal/api";

/** A run of text, optionally a mention (by DID) or an http(s) link. */
export type RichTextSegment = { text: string; mentionDid?: string; linkUri?: string };

const encoder = new TextEncoder();

/** Facets index UTF-8 bytes; JavaScript strings index UTF-16 code units. */
function byteToCodeUnitOffsets(text: string) {
  const offsets: number[] = [];
  let byteOffset = 0;

  for (let i = 0; i < text.length; i += 1) {
    offsets[byteOffset] = i;
    const codePoint = text.codePointAt(i) || 0;
    byteOffset += encoder.encode(String.fromCodePoint(codePoint)).length;

    if (codePoint > 0xffff) i += 1;
  }

  offsets[byteOffset] = text.length;

  return offsets;
}

/**
 * Splits text into plain runs, mentions, and links using its facets. Facets that
 * overlap an earlier one, fall inside a character, or link to a non-http(s)
 * scheme are shown as plain text.
 */
export function richTextSegments(text: string, facets?: readonly RichTextFacet[]): RichTextSegment[] {
  const sorted = (facets ?? [])
    .filter((facet) => facet.index && facet.features?.length)
    .sort((a, b) => (a.index?.byteStart || 0) - (b.index?.byteStart || 0));

  if (sorted.length === 0) return text ? [{ text }] : [];

  const offsets = byteToCodeUnitOffsets(text);
  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    const start = offsets[facet.index?.byteStart || 0];
    const end = offsets[facet.index?.byteEnd || 0];

    if (start === undefined || end === undefined || start < cursor) continue;

    if (start > cursor) segments.push({ text: text.slice(cursor, start) });

    const feature = facet.features?.[0];
    const segment: RichTextSegment = { text: text.slice(start, end) };

    if (feature?.did) segment.mentionDid = feature.did;
    else if (feature?.uri && /^https?:\/\//i.test(feature.uri)) segment.linkUri = feature.uri;

    segments.push(segment);
    cursor = end;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return segments;
}
