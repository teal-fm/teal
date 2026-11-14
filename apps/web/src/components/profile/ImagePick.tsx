import { useEffect, useRef, type ReactNode } from "react";

/**
 * A button that opens the file picker for one PNG or JPEG and hands back an
 * object URL. The shared profile code fetches that URL to upload the blob.
 */
export function ImagePick({
  label,
  onPick,
  className,
  children,
}: {
  label: string;
  onPick: (uri: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const made = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const uri of made.current) URL.revokeObjectURL(uri);
    },
    [],
  );
  return (
    <>
      <button type="button" aria-label={label} onClick={() => input.current?.click()} className={className}>
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const uri = URL.createObjectURL(file);
          made.current.push(uri);
          onPick(uri);
        }}
      />
    </>
  );
}
