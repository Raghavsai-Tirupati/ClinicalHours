import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DemoStageProps {
  /** Tiny text shown in the fake window's title bar — e.g. "applications hub". */
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared 16:9 wrapper used by every animated demo. The outer surface is a
 * subtle desktop "wallpaper" gradient; the inner panel is a chromed app
 * window that floats on it with a soft drop shadow. This makes each demo
 * read as a real desktop app capture rather than a free-floating UI.
 */
export function DemoStage({ title, children, className }: DemoStageProps) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-200/70",
        // Soft desktop wallpaper — neutral so it never competes with the content.
        "bg-[linear-gradient(135deg,rgb(228,228,231)_0%,rgb(244,244,245)_45%,rgb(228,228,231)_100%)]",
        "p-3",
        className,
      )}
    >
      <div className="relative w-full h-full overflow-hidden rounded-lg border border-zinc-300/70 bg-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)]">
        {/* Fake window chrome */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-3.5 py-2 border-b border-zinc-100 bg-zinc-50/85 backdrop-blur-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 text-[10px] font-mono text-zinc-400 truncate">
            {title}
          </span>
        </div>
        {/* Body — pad-top to clear the chrome */}
        <div className="absolute inset-0 pt-8 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export default DemoStage;
