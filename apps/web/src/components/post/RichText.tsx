import type { RichTextFacet } from "@teal/client/teal/api";
import { richTextSegments } from "@teal/client/richText";
import { cn } from "@teal/client/utils";
import { A } from "~/ds";

/** Text with mention and link facets, as written by Bluesky-style composers. */
export function RichText({ text = "", facets, className }: { text?: string; facets?: readonly RichTextFacet[]; className?: string }) {
  const classes = cn("whitespace-pre-wrap break-words", className);

  return (
    <p className={classes}>
      {richTextSegments(text, facets).map((segment, index) => {
        const key = `${index}-${segment.text}`;

        if (segment.mentionDid) {
          return (
            <A key={key} href={`/profile/${segment.mentionDid}`} className="font-semibold text-tint hover:underline">
              {segment.text}
            </A>
          );
        }

        if (segment.linkUri) {
          return (
            <a key={key} href={segment.linkUri} target="_blank" rel="noopener noreferrer" className="font-semibold text-tint hover:underline">
              {segment.text}
            </a>
          );
        }

        return <span key={key}>{segment.text}</span>;
      })}
    </p>
  );
}
