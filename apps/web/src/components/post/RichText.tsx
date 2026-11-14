import { cn } from "@teal/client/utils";
import { A } from "~/ds";

type ByteSlice = { byteStart: number; byteEnd: number };
type FacetFeature = { $type?: string; did?: string; uri?: string; tag?: string };
type Facet = { index?: ByteSlice; features?: FacetFeature[] };

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

/** Text with mention and link facets, as written by Bluesky-style composers. */
export function RichText({ text = "", facets, className }: { text?: string; facets?: unknown; className?: string }) {
  const normalized = (Array.isArray(facets) ? (facets as Facet[]) : [])
    .filter((facet) => facet.index && facet.features?.length)
    .sort((a, b) => (a.index?.byteStart || 0) - (b.index?.byteStart || 0));
  const classes = cn("whitespace-pre-wrap break-words", className);
  if (normalized.length === 0) return <p className={classes}>{text}</p>;

  const offsets = byteToCodeUnitOffsets(text);
  const parts: { text: string; feature?: FacetFeature }[] = [];
  let cursor = 0;
  for (const facet of normalized) {
    const start = offsets[facet.index?.byteStart || 0];
    const end = offsets[facet.index?.byteEnd || 0];
    if (start === undefined || end === undefined || start < cursor) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: text.slice(start, end), feature: facet.features?.[0] });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });

  return (
    <p className={classes}>
      {parts.map((part, index) => {
        const key = `${index}-${part.text}`;
        if (part.feature?.did) {
          return (
            <A key={key} href={`/profile/${part.feature.did}`} className="font-semibold text-tint hover:underline">
              {part.text}
            </A>
          );
        }
        if (part.feature?.uri && /^https?:\/\//.test(part.feature.uri)) {
          return (
            <a key={key} href={part.feature.uri} target="_blank" rel="noopener noreferrer" className="font-semibold text-tint hover:underline">
              {part.text}
            </a>
          );
        }
        return <span key={key}>{part.text}</span>;
      })}
    </p>
  );
}
