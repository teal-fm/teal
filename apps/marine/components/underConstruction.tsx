"use client";

import { useEffect, useRef, useState } from "react";

export default function UnderConstruction() {
  const [repeatedText, setRepeatedText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const calculateRepeats = () => {
      if (!containerRef.current) return;
      const baseText = "Under Construction ⚠️ Work in Progress ⚠️ ";
      const textWidth = baseText.length * 10;
      const screenWidth = window.innerWidth;
      const repeatsNeeded = Math.ceil((screenWidth * 2) / textWidth);
      setRepeatedText(baseText.repeat(repeatsNeeded));
    };

    calculateRepeats();
    window.addEventListener("resize", calculateRepeats);
    return () => window.removeEventListener("resize", calculateRepeats);
  }, []);

  return (
    <div className="bg-full max-h-0">
      {/* Banner moved down from top */}
      <div className="absolute top-24 md:top-28 left-0 right-0 overflow-visible max-w-screen">
        <div className="construction-banner relative bg-yellow-300 dark:bg-yellow-600 h-8 shadow-xl transform -rotate-1 hover:-rotate-0 transition-transform overflow-hidden">
          {/* Darker stripes with higher contrast */}
          <div className="absolute inset-0 overflow-hidden marquee-container">
            <div className="warning-stripes absolute inset-0 opacity-30 dark:opacity-20" />
          </div>

          {/* Darker text for better contrast */}
          <div className="relative h-full flex items-center" ref={containerRef}>
            <div className="marquee-container overflow-hidden w-full">
              <div className="marquee-content whitespace-nowrap text-sm font-black uppercase tracking-widest text-black dark:text-white">
                {repeatedText}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .warning-stripes {
          background: repeating-linear-gradient(
            45deg,
            rgba(0, 0, 0, 0.9),
            rgba(0, 0, 0, 0.9) 10px,
            transparent 10px,
            transparent 20px
          );
          animation: stripe-slide 15s linear infinite;
        }

        .marquee-container {
          mask-image: linear-gradient(
            to right,
            transparent 0%,
            black 5%,
            black 95%,
            transparent 100%
          );
        }

        .marquee-content {
          animation: text-slide 40s linear infinite;
          display: inline-block;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        @keyframes stripe-slide {
          from {
            transform: translateX(20px);
          }
          to {
            transform: translateX(-20px);
          }
        }

        @keyframes text-slide {
          from {
            transform: translateX(-50%);
          }
          to {
            transform: translateX(00%);
          }
        }

        @media (prefers-color-scheme: dark) {
          .warning-stripes {
            background: repeating-linear-gradient(
              45deg,
              rgba(255, 255, 255, 0.9),
              rgba(255, 255, 255, 0.9) 10px,
              transparent 10px,
              transparent 20px
            );
          }
        }
      `}</style>
    </div>
  );
}
