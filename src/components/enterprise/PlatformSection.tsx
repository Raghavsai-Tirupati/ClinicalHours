import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { FadeUp } from "@/components/enterprise/animations/FadeUp";
import { VideoSlot } from "@/components/enterprise/animations/VideoSlot";
import { cn } from "@/lib/utils";

interface PlatformFeature {
  icon: LucideIcon;
  title: string;
  body: string;
  video: string;
  slotName: string;
}

interface PlatformSectionProps {
  features: PlatformFeature[];
}

/**
 * Sticky-scroll storytelling pattern for the platform features.
 *
 * Desktop (md+): the 4 feature blocks stack vertically in the left column
 * with generous spacing. The right column is `sticky` and shows the demo
 * video for whichever feature is currently centered in the viewport. As
 * the user scrolls past each block, the right-side video cross-fades to
 * the next.
 *
 * Mobile: the sticky pattern doesn't make sense at narrow widths, so each
 * feature is rendered as a stacked block with its video inline beneath it.
 */
export function PlatformSection({ features }: PlatformSectionProps) {
  return (
    <section id="platform" className="py-28 sm:py-36 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-16 sm:mb-24">
          <FadeUp>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6">
              The platform
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              One platform.
              <br />
              Every workforce operation.
            </h2>
          </FadeUp>
        </div>

        <DesktopStickyScroll features={features} />
        <MobileStack features={features} />
      </div>
    </section>
  );
}

function DesktopStickyScroll({ features }: PlatformSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observers: IntersectionObserver[] = [];
    blockRefs.current.forEach((el, i) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveIdx(i);
        },
        // Activate when the block crosses the centre 30% of viewport
        { rootMargin: "-35% 0px -35% 0px", threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [features.length]);

  return (
    <div className="hidden md:grid grid-cols-12 gap-12 lg:gap-16">
      {/* Left column — feature blocks */}
      <div className="col-span-7 space-y-32 lg:space-y-40">
        {features.map((feature, i) => (
          <FeatureBlock
            key={feature.slotName}
            feature={feature}
            isActive={i === activeIdx}
            onMount={(el) => {
              blockRefs.current[i] = el;
            }}
            index={i}
          />
        ))}
      </div>

      {/* Right column — sticky video stack with cross-fade */}
      <div className="col-span-5">
        <div className="sticky top-24">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br from-muted/20 to-muted/5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.slotName}
                initial={false}
                animate={{ opacity: i === activeIdx ? 1 : 0 }}
                transition={{
                  duration: reduce ? 0 : 0.4,
                  ease: [0.21, 0.47, 0.32, 0.98],
                }}
                className="absolute inset-0"
                aria-hidden={i !== activeIdx}
              >
                {/* Render each video without its own border so they layer cleanly */}
                <BareVideoSlot
                  src={feature.video}
                  slotName={feature.slotName}
                  paused={i !== activeIdx}
                />
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
            <span>30-second demo</span>
            <span aria-live="polite">
              {String(activeIdx + 1).padStart(2, "0")} / {String(features.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FeatureBlockProps {
  feature: PlatformFeature;
  isActive: boolean;
  onMount: (el: HTMLDivElement | null) => void;
  index: number;
}

function FeatureBlock({ feature, isActive, onMount, index }: FeatureBlockProps) {
  const Icon = feature.icon;
  return (
    <div
      ref={onMount}
      className={cn(
        "transition-opacity duration-300",
        isActive ? "opacity-100" : "opacity-50 hover:opacity-80",
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <span className="font-mono text-xs text-emerald-400/60 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Icon className="h-7 w-7 text-emerald-400 mb-6" strokeWidth={1.5} />
      <h3 className="font-mono text-2xl lg:text-3xl mb-5 tracking-tight">
        {feature.title}
      </h3>
      <p className="text-base lg:text-lg text-white/65 leading-relaxed mb-6 max-w-md">
        {feature.body}
      </p>
      <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50 hover:text-white transition-colors duration-150 cursor-default">
        Learn more
        <ArrowRight className="h-3 w-3" />
      </span>
    </div>
  );
}

function MobileStack({ features }: PlatformSectionProps) {
  return (
    <div className="md:hidden space-y-20">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <FadeUp key={feature.slotName}>
            <div>
              <Icon className="h-6 w-6 text-emerald-400 mb-5" strokeWidth={1.5} />
              <h3 className="font-mono text-xl mb-4 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-sm text-white/65 leading-relaxed mb-6">
                {feature.body}
              </p>
              <VideoSlot
                src={feature.video}
                slotName={feature.slotName}
                caption="30-second demo"
              />
            </div>
          </FadeUp>
        );
      })}
    </div>
  );
}

/**
 * Variant of VideoSlot without the outer border / caption — used inside the
 * sticky cross-fade where the parent container already provides the frame.
 */
function BareVideoSlot({
  src,
  slotName,
  paused,
}: {
  src: string;
  slotName: string;
  paused?: boolean;
}) {
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

  if (exists === false) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
        data-video-slot={slotName}
      >
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
        <PlaceholderIcon />
        <span className="relative text-xs uppercase tracking-wider">
          Demo video — recording in progress
        </span>
      </div>
    );
  }

  if (exists) {
    return (
      <video
        key={src}
        src={src}
        autoPlay={!paused}
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        data-video-slot={slotName}
        onError={() => setExists(false)}
      />
    );
  }

  return null;
}

const PlaceholderIcon: ComponentType = () => (
  <svg
    className="relative h-12 w-12 opacity-30"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

export default PlatformSection;
