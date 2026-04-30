import { motion, useScroll, useSpring } from "motion/react";

/**
 * 1px emerald progress bar pinned to the top of the viewport. Driven by
 * the document scroll position; smoothed with a spring so it feels
 * physical rather than locked.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });
  return (
    <motion.div
      style={{ scaleX, transformOrigin: "0% 50%" }}
      className="fixed top-0 left-0 right-0 z-[60] h-px bg-zinc-900"
      aria-hidden
    />
  );
}

export default ScrollProgress;
