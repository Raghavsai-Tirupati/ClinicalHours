import { useEffect, useRef } from "react";

/**
 * 1px progress bar pinned to the top of the viewport, driven by a plain
 * scroll event listener — avoids the motion/react null-dispatcher crash.
 */
export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = total > 0 ? scrolled / total : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div
      ref={barRef}
      style={{ transformOrigin: "0% 50%", transform: "scaleX(0)" }}
      className="fixed top-0 left-0 right-0 z-[60] h-px bg-zinc-900"
      aria-hidden
    />
  );
}

export default ScrollProgress;
