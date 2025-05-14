"use client";

import React from "react";
import { motion } from "framer-motion";

interface StaggeredTextProps {
  children: React.ReactNode; // Accept children
  className?: string;
  offset?: number;
  delay?: number;
  duration?: number;
  staggerDelay?: number;
  once?: boolean;
  as?: React.ElementType;
}

export default function StaggeredText({
  children,
  className = "",
  offset = 20,
  delay = 0,
  duration = 0.1,
  staggerDelay = 0.15,
  once = false,
  as: Component = "div",
}: StaggeredTextProps) {
  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    visible: {
      // Removed (i = 1) as it's not used in transition.delayChildren
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
        when: "beforeChildren",
      },
    },
  };

  const child = {
    hidden: {
      opacity: 0,
      filter: "blur(5px)",
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        opacity: {
          duration: duration / 2,
          type: "tween",
        },
        filter: {
          duration: duration / 2,
          type: "tween",
        },
        // delayChildren removed - handled by container staggerChildren
      },
    },
  };

  const childTranslate = {
    hidden: {
      y: offset,
    },
    visible: {
      y: 0,
      transition: {
        y: {
          duration: duration,
          type: "easeInOut",
          damping: 0,
          stiffness: 100,
        },
      },
    },
  };

  // Function to wrap a single token or element with animation spans
  const wrapWithAnimation = (item: React.ReactNode, key: string) => (
    <motion.span
      key={key}
      variants={child}
      style={{ display: "inline-block" }}
      className="origin-bottom"
      viewport={{ once }}
    >
      <motion.span
        style={{ display: "inline-block" }}
        variants={childTranslate}
        viewport={{ once }}
      >
        {item}
      </motion.span>
    </motion.span>
  );

  return (
    <Component className={className}>
      <motion.span
        style={{ display: "inline-block", whiteSpace: "pre-wrap" }}
        variants={container}
        initial="hidden"
        whileInView="visible"
        viewport={{ once }}
      >
        {/* Map over children and handle strings differently */}
        {React.Children.toArray(children).flatMap((childElement, index) => {
          if (typeof childElement === "string") {
            // Split the string into tokens (words, spaces, newlines, <br/>)
            // Keep delimiters to handle spaces and <br/>/newlines correctly
            const tokens = childElement.split(/(\s+|<br\/>|\n)/g);

            console.log(tokens);

            return tokens
              .map((token, tokenIndex) => {
                if (!token) return null; // Handle empty strings that might result from split at start/end or consecutive delimiters

                if (token === "<br/>") {
                  return <br key={`br-${index}-${tokenIndex}`} />;
                } else if (token === "\n") {
                  return <br key={`newline-${index}-${tokenIndex}`} />; // Treat \n as <br/>
                } else if (/\s+/.test(token)) {
                  return (
                    <span key={`space-${index}-${tokenIndex}`}>{token}</span>
                  ); // Render spaces directly
                } else {
                  // Wrap actual words/text segments with animation
                  return wrapWithAnimation(
                    token,
                    `word-${index}-${tokenIndex}`,
                  );
                }
              })
              .filter((item) => item !== null); // Filter out nulls from empty tokens
          } else {
            if (
              typeof childElement == "object" &&
              "type" in childElement &&
              childElement?.type == "br"
            ) {
              return childElement;
            }
            return wrapWithAnimation(childElement, `element-${index}`);
          }
        })}
      </motion.span>
    </Component>
  );
}
