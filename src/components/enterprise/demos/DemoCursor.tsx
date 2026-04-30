import { motion } from "motion/react";

interface DemoCursorProps {
  /** CSS left value, e.g. "45%" or 120 */
  x: string | number;
  /** CSS top value, e.g. "60%" or 80 */
  y: string | number;
  /** When true, the cursor briefly contracts to suggest a click. */
  click?: boolean;
}

/**
 * Tiny mac-style arrow cursor that animates between positions. Each demo
 * defines a per-step position map and renders one of these — making the
 * looping animations feel "operated" rather than autoplaying.
 *
 * Positions are CSS top/left so they accept percentages relative to the
 * containing positioned element.
 */
export function DemoCursor({ x, y, click }: DemoCursorProps) {
  return (
    <motion.div
      initial={false}
      animate={{ left: x, top: y, scale: click ? 0.85 : 1 }}
      transition={{
        left: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
        top: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
        scale: { duration: 0.18, ease: "easeOut" },
      }}
      className="absolute z-40 pointer-events-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
      aria-hidden
    >
      <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
        <path
          d="M2 1.5 L2 13.5 L4.8 11 L7.2 16 L9.2 15.1 L6.8 10 L11 9.5 Z"
          fill="rgb(24 24 27)"
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}

export default DemoCursor;
