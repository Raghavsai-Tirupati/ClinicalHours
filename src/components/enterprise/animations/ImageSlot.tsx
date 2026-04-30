import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageSlotProps {
  /** Path under /public, e.g. "/enterprise/hero-image.jpg" */
  src: string;
  /** Alt text used when the image loads. */
  alt: string;
  className?: string;
  /** aspectRatio CSS value applied to the slot when no className overrides it. */
  aspectRatio?: string;
  /** Tag for grep when wiring real assets. */
  slotName?: string;
  /** Forwarded to the rendered <img>. Useful for lazy / eager hints. */
  loading?: "eager" | "lazy";
}

/**
 * Renders an image if the file exists at `src`, otherwise renders a
 * moody gradient placeholder that matches the dark editorial aesthetic
 * we're going for. HEAD-probes the file on mount and only swaps in the
 * <img> when the response is image/*.
 */
export function ImageSlot({
  src,
  alt,
  className,
  aspectRatio,
  slotName,
  loading = "lazy",
}: ImageSlotProps) {
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        const contentType = res.headers.get("content-type") ?? "";
        setExists(res.ok && contentType.startsWith("image/"));
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !className?.includes("aspect-") && !aspectRatio && "aspect-[4/5]",
        className,
      )}
      style={aspectRatio ? { aspectRatio } : undefined}
      data-image-slot={slotName}
    >
      {exists ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setExists(false)}
        />
      ) : (
        <>
          {/* Layered gradient placeholder — reads as moody architectural */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(52,211,153,0.10), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04), transparent 60%)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
            <ImageIcon className="h-10 w-10" strokeWidth={1.25} />
            <span className="text-[10px] uppercase tracking-[0.25em]">
              Image — drop in /public{src}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default ImageSlot;
