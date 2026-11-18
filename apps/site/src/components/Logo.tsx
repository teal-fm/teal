import { useEffect, useState } from "react";
import { AudioLines, Music2, Radio } from "lucide-react";

const ICONS = [Music2, Radio, AudioLines];

/** The teal.fm wordmark, with the badge cycling through its three icons. */
export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (
      size !== "lg" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % ICONS.length),
      2000,
    );

    return () => clearInterval(timer);
  }, [size]);
  const Icon = ICONS[index];
  const large = size === "lg";

  return (
    <span className={`inline-flex items-center ${large ? "gap-1" : "gap-1.5"}`}>
      <span
        aria-hidden
        className={`grid shrink-0 place-items-center rounded-full bg-teal-500 text-white ${large ? "size-14 p-3 sm:size-16" : "size-8 p-1.5"}`}
      >
        <Icon key={index} className="logo-swap size-full" />
      </span>
      <span
        className={`font-semibold tracking-tight ${large ? "text-6xl sm:text-8xl" : "text-2xl"}`}
      >
        teal<span className="font-serif italic text-teal-500">.fm</span>
      </span>
    </span>
  );
}
