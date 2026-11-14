import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Disc3 } from "lucide-react";
import { coverArtUrl, getReleaseGroupCoverArtUrl } from "@teal/client/teal/api";
import { cn } from "@teal/client/utils";

import { Icon } from "./Icon";

export function coverUri(releaseMbId?: string, size = 500) {
  return coverArtUrl(releaseMbId, size);
}

const otherSize = (uri: string) =>
  uri.replace(/front-(250|500)$/, (_, n) => `front-${n === "250" ? 500 : 250}`);

/**
 * Square release artwork, with a quiet disc placeholder when there is none.
 * A missing release cover tries its release group, then the other thumbnail
 * size, and the archive's streaky failures get a couple of delayed retries.
 */
export function Cover({
  releaseMbId,
  uri,
  size,
  radius = 12,
  className,
  style,
  label,
  eager,
}: {
  releaseMbId?: string;
  uri?: string;
  /** A fixed size in pixels; omit to fill the parent's width. */
  size?: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
  /** Names the image; unlabelled covers sit beside text that names the album. */
  label?: string;
  /** Load straight away, for covers above the fold. */
  eager?: boolean;
}) {
  const artSize = size && size <= 250 ? 250 : 500;
  const primary = uri ?? coverUri(releaseMbId, artSize);
  const [fallback, setFallback] = useState<{ from: string; uri?: string }>();
  const [failed, setFailed] = useState<string[]>([]);
  const [retried, setRetried] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<string>();
  const restarts = useRef(0);
  const checked = useRef<string>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const source = primary && fallback?.from === primary ? fallback.uri : primary;

  const retry = (target: string) => {
    if (retried.includes(target)) {
      setFailed((current) => [...current, target]);
      const other = otherSize(target);
      if (other !== target && !failed.includes(other)) {
        setFallback({ from: primary ?? target, uri: other });
      } else if (!timer.current && restarts.current < 2) {
        timer.current = setTimeout(() => {
          timer.current = null;
          restarts.current += 1;
          setFallback(undefined);
          setFailed([]);
          setRetried([]);
          setAttempt((n) => n + 1);
        }, 20000 * (restarts.current + 1));
      }
      return;
    }
    setRetried((current) => [...current, target]);
    setTimeout(() => setAttempt((n) => n + 1), 1200);
  };

  const onError = () => {
    if (!source) return;
    if (source === primary && !uri && releaseMbId && fallback?.from !== primary) {
      setFallback({ from: primary, uri: primary });
      void getReleaseGroupCoverArtUrl(releaseMbId, artSize).then((next) => {
        if (next && next !== primary) setFallback({ from: primary, uri: next });
        else retry(primary);
      });
      return;
    }
    retry(source);
  };

  const src = source && !failed.includes(source) ? source : undefined;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative block aspect-square shrink-0 overflow-hidden bg-fill", !size && "w-full", className)}
      style={{ borderRadius: radius, ...(size ? { width: size, height: size } : null), ...style }}
    >
      {/* The disc sits underneath, so a cover that's loading or failing never leaves a hole. */}
      <span className="absolute inset-0 flex items-center justify-center">
        <Icon icon={Disc3} size={(size ?? 64) * 0.4} className="text-ink-3" />
      </span>
      {src ? (
        <img
          key={`${src}#${attempt}`}
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          // A server-rendered image can finish before hydration attaches these handlers.
          ref={(img) => {
            const key = `${src}#${attempt}`;
            if (!img?.complete || checked.current === key) return;
            checked.current = key;
            if (img.naturalWidth > 0) setLoaded(src);
            else onError();
          }}
          onLoad={() => setLoaded(src)}
          onError={onError}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200",
            loaded === src ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}
