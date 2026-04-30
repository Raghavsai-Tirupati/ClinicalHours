import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DemoStageProps {
  /** Tiny text shown in the fake window's title bar — e.g. "applications hub". */
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * macOS Big Sur-inspired wallpaper, rendered entirely with CSS gradients
 * (no image asset, no licensing concerns).
 */
const DESKTOP_WALLPAPER = `
  radial-gradient(ellipse 100% 70% at 50% 35%, rgba(99, 102, 241, 0.55) 0%, transparent 65%),
  radial-gradient(ellipse 80% 55% at 80% 85%, rgba(236, 72, 153, 0.5) 0%, transparent 60%),
  radial-gradient(ellipse 70% 50% at 15% 90%, rgba(168, 85, 247, 0.4) 0%, transparent 60%),
  linear-gradient(180deg, #0b0a2e 0%, #1e1b4b 25%, #4c1d95 60%, #831843 100%)
`;

// The window is rendered at this fixed "design" size and then scaled
// proportionally to fit the available area. This keeps every layout
// pixel — typography, spacing, cursor positions — identical at every
// viewport. Mobile becomes a true smaller copy of desktop instead of a
// cramped responsive variant where fixed-px text fights a shrinking
// container.
const DESIGN_W = 528;
const DESIGN_H = 268;

export function DemoStage({ title, children, className }: DemoStageProps) {
  const fitRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      setScale(
        Math.min(rect.width / DESIGN_W, rect.height / DESIGN_H),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl border border-zinc-300/40 shadow-[0_2px_24px_rgba(0,0,0,0.06)]",
        "p-5 sm:p-9",
        className,
      )}
      style={{ backgroundImage: DESKTOP_WALLPAPER }}
    >
      {/* Fit container — measured to compute the scale factor. */}
      <div
        ref={fitRef}
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Window — rendered at the design size, then scaled to fit. */}
        <div
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
          className="relative overflow-hidden rounded-2xl border border-zinc-300/70 bg-white shadow-[0_22px_50px_-12px_rgba(15,23,42,0.6),0_4px_14px_-4px_rgba(15,23,42,0.3)]"
        >
          {/* Fake window chrome — macOS traffic-light colors */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-3.5 py-2 border-b border-zinc-100 bg-zinc-50/85 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[10px] font-mono text-zinc-400 truncate">
              {title}
            </span>
          </div>
          {/* Body — pad-top to clear the chrome */}
          <div className="absolute inset-0 pt-8 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default DemoStage;
