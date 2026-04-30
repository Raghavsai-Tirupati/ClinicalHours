import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

interface FadeUpProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "h2" | "h3" | "p" | "li" | "span";
  once?: boolean;
}

/**
 * Fade up + 16px Y translation when entering the viewport.
 * Triggers slightly before the element fully enters view (margin: -100px).
 * Disables transforms when prefers-reduced-motion is set.
 */
export function FadeUp({
  children,
  delay = 0,
  y = 16,
  duration = 0.6,
  className,
  as = "div",
  once = true,
}: FadeUpProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-100px" }}
      variants={variants}
      transition={{
        duration: reduce ? 0 : duration,
        delay: reduce ? 0 : delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </Component>
  );
}

export default FadeUp;
