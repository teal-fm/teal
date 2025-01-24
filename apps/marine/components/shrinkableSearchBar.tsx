import * as React from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function ShrinkableSearchBar() {
  const [isOpen, setIsOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // For client-side portal mounting
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if the pressed key is '/'
      if (
        e.key === "/" &&
        !isOpen &&
        // Prevent activation when typing in an input or textarea
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          isOpen ? "opacity-0 translate-y-5" : "opacity-100",
          "h-9 md:w-44 md:justify-between md:bg-secondary/50 md:hover:bg-secondary border border-border rounded-full cursor-text transition-all",
        )}
      >
        <span className="hidden text-sm md:block text-muted-foreground">
          Search
        </span>
        <div className="flex flex-row items-center gap-2">
          {/* <KbdKey keys={["/"]} /> */}
          <Search className="h-4 w-4" />
        </div>
      </Button>
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="fixed inset-0 z-10 bg-primary-foreground/65 backdrop-blur-xs"
              >
                <div className="container mx-auto">
                  <div className="flex h-full flex-col items-center justify-start pt-24">
                    <motion.button
                      className="absolute right-4 top-4 p-2"
                      onClick={() => setIsOpen(false)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="h-6 w-6" />
                    </motion.button>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="w-full max-w-2xl px-4"
                    >
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          ref={inputRef}
                          type="search"
                          placeholder="Search anything..."
                          className="w-full bg-background pl-10 text-lg rounded-full"
                        />
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 space-y-4"
                      >
                        <div className="text-sm text-muted-foreground">
                          Start typing to search...
                        </div>
                      </motion.div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
