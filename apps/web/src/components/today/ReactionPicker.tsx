import { useEffect, useRef, useState } from "react";
import { QUICK_REACTIONS } from "@teal/client/teal/reactions";

/** A single grapheme-ish emoji: no letters, digits, or spaces. */
function asEmoji(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[\p{L}\p{N}\s]/u.test(trimmed)) return undefined;
  return [...new Intl.Segmenter().segment(trimmed)][0]?.segment;
}

/** The quick reactions plus any emoji from the keyboard, in a modal <dialog>. */
export function ReactionPicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (visible && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
    if (!visible && dialog.open) dialog.close();
  }, [visible]);
  const pick = (emoji: string) => {
    setCustom("");
    onPick(emoji);
    onClose();
  };
  return (
    <dialog
      ref={ref}
      aria-label="Add a reaction"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto rounded-[28px] border border-glass-edge bg-glass-strong p-3 text-ink backdrop-blur-2xl backdrop:bg-black/30"
    >
      <div className="flex flex-col items-center gap-3">
        <div role="menu" className="flex gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              aria-label={`React ${emoji}`}
              onClick={() => pick(emoji)}
              className="flex size-12 items-center justify-center rounded-full text-[28px] transition-transform hover:scale-125 motion-reduce:hover:scale-100"
            >
              {emoji}
            </button>
          ))}
        </div>
        <input
          value={custom}
          onChange={(event) => {
            const emoji = asEmoji(event.target.value);
            if (emoji) pick(emoji);
            else setCustom(event.target.value);
          }}
          placeholder="Any emoji"
          aria-label="Type any emoji"
          className="field-in-panel h-11 w-full rounded-full bg-fill px-4 text-[17px] text-ink outline-none"
        />
      </div>
    </dialog>
  );
}
