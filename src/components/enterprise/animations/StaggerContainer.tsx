import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

interface StaggerContainerProps {
  children: ReactNode;
  stagger?: number;
  delayChildren?: number;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
  once?: boolean;
}

/**
 * Wraps a group of children that should reveal in sequence. Each child
 * should be (or contain) a <StaggerItem /> for the cascade to take effect.
 */
export function StaggerContainer({
  children,
  stagger = 0.07,
  delayChildren = 0,
  className,
  as = "div",
  once = true,
}: StaggerContainerProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  const variants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduce ? 0 : stagger,
        delayChildren: reduce ? 0 : delayChildren,
      },
    },
  };

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-100px" }}
      variants={variants}
    >
      {children}
    </Component>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  y?: number;
  as?: "div" | "li" | "span" | "p" | "section";
}

export function StaggerItem({
  children,
  className,
  y = 16,
  as = "div",
}: StaggerItemProps) {
  const reduce = useReducedMotion();
  const Component = motion[as];

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.55,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    },
  };

  return (
    <Component className={className} variants={variants}>
      {children}
    </Component>
  );
}

export default StaggerContainer;
