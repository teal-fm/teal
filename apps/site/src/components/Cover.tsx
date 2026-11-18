import { useEffect, useRef, useState } from "react";
import { Disc3 } from "lucide-react";

import { coverUrl } from "~/lib/format";

/** Release artwork from the Cover Art Archive, or a quiet disc when there is none. */
export function Cover({
  releaseMbId,
  size = 44,
}: {
  releaseMbId?: string;
  size?: number;
}) {
  const src = coverUrl(releaseMbId, size > 120 ? 500 : 250);
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A 404 that lands before hydration never reaches onError.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0)
      setFailed(true);
  }, []);

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-md bg-teal-500/15 text-teal-600/60 dark:text-teal-300/40"
      style={{ width: size, height: size }}
    >
      <Disc3 aria-hidden className="size-1/2" />
      {src && !failed && (
        <img
          ref={img}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
