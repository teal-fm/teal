import type { ReactNode } from "react";
import { AmbientSource, Cover, coverUri, Heading } from "~/ds";

/**
 * The top of an artist, album, or song page: big artwork that tints the backdrop,
 * then the title and its context lines.
 */
export function MusicHero({
  releaseMbId,
  imageUri,
  round,
  title,
  lines,
  actions,
}: {
  releaseMbId?: string;
  /** Artwork that isn't a release cover, such as an artist photo. */
  imageUri?: string;
  round?: boolean;
  title: string;
  lines: ReactNode[];
  actions?: ReactNode;
}) {
  const ambient = imageUri ?? coverUri(releaseMbId);
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end">
      <AmbientSource uri={ambient} className="self-start">
        <Cover releaseMbId={imageUri ? undefined : releaseMbId} uri={imageUri} size={232} radius={round ? 116 : 16} className="shadow-2xl" eager />
      </AmbientSource>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Heading level={1} size="hero" onBackdrop className="line-clamp-3 break-words">
          {title}
        </Heading>
        {lines.map((line, i) =>
          typeof line === "string" ? (
            <p key={i} className="halo text-[16px] text-ink-2">
              {line}
            </p>
          ) : (
            <div key={i}>{line}</div>
          ),
        )}
        {actions ? <div className="mt-3 flex flex-wrap items-start gap-2.5">{actions}</div> : null}
      </div>
    </header>
  );
}
