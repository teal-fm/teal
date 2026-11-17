import { Linking, Pressable } from "react-native";
import { Link } from "expo-router";
import type { RichTextFacet } from "@teal/client/teal/api";
import { richTextSegments } from "@teal/client/richText";
import { Text } from "@/components/ds";
import { appHref } from "@/lib/href";

/** Text with mention and link facets, as written by Bluesky-style composers. */
export default function RichText({
  text = "",
  facets,
  className,
}: {
  text?: string;
  facets?: readonly RichTextFacet[];
  className?: string;
}) {
  return (
    <Text className={className}>
      {richTextSegments(text, facets).map((segment, index) => {
        const key = `${segment.text}-${index}`;
        const { mentionDid, linkUri } = segment;

        if (mentionDid) {
          return (
            <Link key={key} href={appHref(`/profile/${mentionDid}`)} asChild>
              <Text className="font-semibold text-tint">{segment.text}</Text>
            </Link>
          );
        }

        if (linkUri) {
          return (
            <Pressable key={key} accessibilityRole="link" onPress={() => void Linking.openURL(linkUri)}>
              <Text className="font-semibold text-tint">{segment.text}</Text>
            </Pressable>
          );
        }

        return segment.text;
      })}
    </Text>
  );
}
