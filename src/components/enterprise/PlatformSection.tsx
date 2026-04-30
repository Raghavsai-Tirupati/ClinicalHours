import { ArrowRight } from "lucide-react";
import { FadeUp } from "@/components/enterprise/animations/FadeUp";
import { VideoSlot } from "@/components/enterprise/animations/VideoSlot";
import { cn } from "@/lib/utils";

interface PlatformFeature {
  /** Uppercase eyebrow shown above the title — e.g. "Applicant tracking". */
  eyebrow?: string;
  title: string;
  body: string;
  video: string;
  slotName: string;
}

interface PlatformSectionProps {
  features: PlatformFeature[];
}

/**
 * OpenLine-style feature showcase: each feature gets its own row with the
 * copy on one side and the demo video on the other, alternating sides for
 * visual rhythm. On mobile everything stacks; the video always sits below
 * its block so reading order is preserved.
 */
export function PlatformSection({ features }: PlatformSectionProps) {
  return (
    <section id="platform" className="py-28 sm:py-36 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-20 sm:mb-28">
          <FadeUp>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              The platform
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-[-0.02em]">
              <span className="text-white/40">One platform.</span>{" "}
              <span className="text-white">Every workforce operation.</span>
            </h2>
          </FadeUp>
        </div>

        <div className="space-y-28 sm:space-y-36 lg:space-y-44">
          {features.map((feature, i) => (
            <FeatureRow key={feature.slotName} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureRowProps {
  feature: PlatformFeature;
  index: number;
}

function FeatureRow({ feature, index }: FeatureRowProps) {
  const reversed = index % 2 === 1;
  const numberLabel = String(index + 1).padStart(2, "0");

  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center",
      )}
    >
      {/* Copy column */}
      <FadeUp
        y={20}
        className={cn(
          "lg:col-span-5",
          reversed ? "lg:order-2" : "lg:order-1",
        )}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-xs text-emerald-400/70 tabular-nums">
            {numberLabel}
          </span>
          <span className="h-px w-8 bg-white/15" />
          {feature.eyebrow ? (
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/55">
              {feature.eyebrow}
            </span>
          ) : null}
        </div>
        <h3 className="font-display text-3xl sm:text-4xl lg:text-[44px] leading-[1.05] tracking-[-0.02em] mb-6 text-white">
          {feature.title}
        </h3>
        <p className="text-base lg:text-lg text-white/60 leading-relaxed mb-8 max-w-md">
          {feature.body}
        </p>
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/55 hover:text-white transition-colors duration-150 cursor-default">
          Learn more
          <ArrowRight className="h-3 w-3" />
        </span>
      </FadeUp>

      {/* Mockup column */}
      <FadeUp
        delay={0.15}
        y={24}
        className={cn(
          "lg:col-span-7",
          reversed ? "lg:order-1" : "lg:order-2",
        )}
      >
        <div className="relative">
          {/* Soft emerald glow behind the video, more pronounced under the active row */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-8 -z-10 opacity-40"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 50%, rgba(52,211,153,0.10) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />
          <VideoSlot
            src={feature.video}
            slotName={feature.slotName}
            caption="30-second demo"
          />
        </div>
      </FadeUp>
    </div>
  );
}

export default PlatformSection;
