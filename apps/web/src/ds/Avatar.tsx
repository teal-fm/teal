import { useState } from "react";
import { getProfileImageUrl } from "@teal/client/teal/actors";
import { cn } from "@teal/client/utils";

/** A round profile picture; falls back to the first letter of the name. Decorative. */
export function Avatar({
  did,
  avatar,
  name,
  size = 40,
  listeningNow = false,
  className,
}: {
  did?: string;
  avatar?: string;
  name?: string;
  size?: number;
  /** Draws the teal "listening now" ring. */
  listeningNow?: boolean;
  className?: string;
}) {
  const uri = did ? getProfileImageUrl(did, avatar, "avatar") : undefined;
  const ring = listeningNow ? Math.max(2, Math.round(size / 24)) : 0;
  // Remember which image failed, so a new avatar URL gets its own chance.
  const [brokenUri, setBrokenUri] = useState<string>();
  return (
    <span
      aria-hidden
      className={cn("block shrink-0 rounded-full", listeningNow && "bg-now", className)}
      style={{ width: size, height: size, padding: ring }}
    >
      <span
        className="relative flex size-full items-center justify-center overflow-hidden rounded-full border-ground bg-fill"
        style={{ borderWidth: ring, borderStyle: ring ? "solid" : undefined }}
      >
        {/* The initial sits underneath, so a missing or broken image still shows who it is. */}
        <span className="font-semibold text-ink-2 select-none" style={{ fontSize: size * 0.4 }}>
          {(name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        {uri && uri !== brokenUri ? (
          <img
            src={uri}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
            ref={(img) => {
              // A server-rendered image can fail before hydration attaches onError.
              if (img?.complete && img.naturalWidth === 0 && brokenUri !== uri) setBrokenUri(uri);
            }}
            onError={() => setBrokenUri(uri)}
          />
        ) : null}
      </span>
    </span>
  );
}
