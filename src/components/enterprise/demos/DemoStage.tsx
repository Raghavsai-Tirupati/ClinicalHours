import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DemoStageProps {
  /** Tiny text shown in the fake window's title bar — e.g. "applications hub". */
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared 16:9 window-chrome wrapper used by every animated demo. Gives
 * each demo the same "we recorded this" framing — title bar, traffic
 * lights, soft border — so they read as polished UI captures rather than
 * arbitrary CSS.
 */
export function DemoStage({ title, children, className }: DemoStageProps) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_2px_24px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {/* Fake window chrome */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1.5 px-3.5 py-2.5 border-b border-zinc-100 bg-zinc-50/80 backdrop-blur-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
        <span className="ml-3 text-[10px] font-mono text-zinc-400 truncate">
          {title}
        </span>
      </div>
      {/* Body — pad-top to clear the chrome */}
      <div className="absolute inset-0 pt-9 overflow-hidden">{children}</div>
    </div>
  );
}

export default DemoStage;
