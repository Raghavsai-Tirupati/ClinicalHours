import { motion, useReducedMotion, type Variants } from "motion/react";
import { Fragment } from "react";

interface WordRevealProps {
  /** Plain text. Newline characters force a line break. */
  text: string;
  className?: string;
  /** Per-word stagger in seconds. */
  stagger?: number;
  /** Initial Y offset for each word. */
  y?: number;
  delay?: number;
  /** Auto-play immediately rather than waiting for viewport entry. */
  immediate?: boolean;
}

/**
 * Splits text into words and animates each one in with a small Y stagger.
 * Used for the hero headline. Preserves explicit \n line breaks via <br />.
 */
export function WordReveal({
  text,
  className,
  stagger = 0.05,
  y = 12,
  delay = 0,
  immediate = true,
}: WordRevealProps) {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delay,
      },
    },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.5,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    },
  };

  const lines = text.split("\n");

  return (
    <motion.span
      className={className}
      variants={container}
      initial="hidden"
      {...(immediate
        ? { animate: "visible" }
        : { whileInView: "visible", viewport: { once: true, margin: "-80px" } })}
    >
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {line.split(" ").map((word, wordIdx) => (
            <motion.span
              key={`${lineIdx}-${wordIdx}`}
              variants={item}
              className="inline-block whitespace-pre"
              style={{ willChange: "transform, opacity" }}
            >
              {word}
              {wordIdx < line.split(" ").length - 1 ? " " : ""}
            </motion.span>
          ))}
          {lineIdx < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </motion.span>
  );
}

export default WordReveal;
