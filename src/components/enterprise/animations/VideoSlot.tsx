import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoSlotProps {
  /** Path under /public, e.g. "/enterprise/hero-loop.mp4" */
  src: string;
  /** Caption shown beneath the video / placeholder. */
  caption?: string;
  /** Disable the autoplay loop (used by sticky-scroll where parent controls visibility). */
  paused?: boolean;
  className?: string;
  /** Tag the slot for grep-ability when wiring real recordings. */
  slotName?: string;
}

/**
 * Renders a 16:9 video tile if the file exists at `src`, otherwise renders
 * a styled "demo recording in progress" shimmer placeholder. Probes the
 * file on mount so the placeholder appears without a network error
 * flashing in the browser console.
 */
export function VideoSlot({
  src,
  caption,
  paused = false,
  className,
  slotName,
}: VideoSlotProps) {
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        setExists(res.ok);
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <figure
      className={cn("flex flex-col gap-3", className)}
      data-video-slot={slotName}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-muted/20 to-muted/5">
        {exists ? (
          <video
            key={src}
            src={src}
            autoPlay={!paused}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setExists(false)}
          />
        ) : (
          <>
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <PlayCircle className="h-12 w-12 opacity-30" />
              <span className="text-xs uppercase tracking-wider">
                Demo video — recording in progress
              </span>
            </div>
          </>
        )}
      </div>
      {caption ? (
        <figcaption className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default VideoSlot;
