import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  motion,
} from "motion/react";
import { useEffect, useRef } from "react";

interface AnimatedCounterProps {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  /** Format the value before render. Defaults to en-US locale grouping. */
  format?: (value: number) => string;
  className?: string;
}

/**
 * Counts up from 0 to `to` over `duration` seconds, but only fires once
 * when the element enters the viewport. Honours prefers-reduced-motion
 * by snapping straight to the end value.
 */
export function AnimatedCounter({
  to,
  duration = 1.5,
  prefix = "",
  suffix = "",
  format,
  className,
}: AnimatedCounterProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const motionValue = useMotionValue(0);
  const formatter = format ?? ((v: number) => Math.round(v).toLocaleString("en-US"));
  const display = useTransform(motionValue, (v) => `${prefix}${formatter(v)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      motionValue.set(to);
      return;
    }
    const controls = animate(motionValue, to, {
      duration,
      ease: [0.21, 0.47, 0.32, 0.98],
    });
    return () => controls.stop();
  }, [inView, to, duration, motionValue, reduce]);

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  );
}

export default AnimatedCounter;
