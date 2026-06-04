import { Linking, Pressable } from "react-native";
import { Link } from "expo-router";
import { Text } from "@/components/ui/text";

type ByteSlice = {
  byteStart: number;
  byteEnd: number;
};

type FacetFeature = {
  $type?: string;
  did?: string;
  uri?: string;
};

type Facet = {
  index?: ByteSlice;
  features?: FacetFeature[];
};

type RichTextProps = {
  text?: string;
  facets?: unknown;
  className?: string;
};

function byteToCodeUnitOffsets(text: string) {
  const offsets: number[] = [];
  let byteOffset = 0;
  for (let i = 0; i < text.length; i += 1) {
    offsets[byteOffset] = i;
    const codePoint = text.codePointAt(i) || 0;
    byteOffset += new TextEncoder().encode(String.fromCodePoint(codePoint)).length;
    if (codePoint > 0xffff) i += 1;
  }
  offsets[byteOffset] = text.length;
  return offsets;
}

function normalizeFacets(facets: unknown): Facet[] {
  return Array.isArray(facets) ? (facets as Facet[]) : [];
}

export default function RichText({ text = "", facets, className }: RichTextProps) {
  const normalized = normalizeFacets(facets)
    .filter((facet) => facet.index && facet.features?.length)
    .sort((a, b) => (a.index?.byteStart || 0) - (b.index?.byteStart || 0));

  if (normalized.length === 0) {
    return <Text className={className}>{text}</Text>;
  }

  const offsets = byteToCodeUnitOffsets(text);
  const parts: Array<{ text: string; feature?: FacetFeature }> = [];
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
    <Text className={className}>
      {parts.map((part, index) => {
        const key = `${part.text}-${index}`;
        if (part.feature?.did) {
          return (
            <Link key={key} href={`/profile/${part.feature.did}` as any} asChild>
              <Text className="font-bold text-primary">{part.text}</Text>
            </Link>
          );
        }
        if (part.feature?.uri) {
          return (
            <Pressable
              key={key}
              onPress={() => Linking.openURL(part.feature?.uri || "")}
            >
              <Text className="font-bold text-primary">{part.text}</Text>
            </Pressable>
          );
        }
        return part.text;
      })}
    </Text>
  );
}
