import { ArrowRight } from "lucide-react";
import { FadeUp } from "@/components/enterprise/animations/FadeUp";
import { VideoSlot } from "@/components/enterprise/animations/VideoSlot";
import { cn } from "@/lib/utils";

interface PlatformFeature {
  /** Eyebrow shown above the title — e.g. "Applicant tracking". */
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
 * visual rhythm. Light theme — sits between the white problem and outputs
 * sections of the enterprise page.
 */
export function PlatformSection({ features }: PlatformSectionProps) {
  return (
    <section id="platform" className="bg-white py-28 sm:py-36 px-6 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mb-20 sm:mb-28">
          <FadeUp>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500 mb-6">
              The platform
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display text-4xl sm:text-5xl md:text-[56px] leading-[1.05] tracking-[-0.02em]">
              <span className="text-zinc-400">One platform.</span>{" "}
              <span className="text-zinc-900">Every workforce operation.</span>
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
      {/* Copy column */}
      <FadeUp
        y={20}
        className={cn(
          "lg:col-span-5",
          reversed ? "lg:order-2" : "lg:order-1",
        )}
      >
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
            {numberLabel}
          </span>
          <span className="h-px w-8 bg-zinc-200" />
          {feature.eyebrow ? (
            <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              {feature.eyebrow}
            </span>
          ) : null}
        </div>
        <h3 className="font-display text-3xl sm:text-4xl lg:text-[44px] leading-[1.05] tracking-[-0.02em] mb-6 text-zinc-900">
          {feature.title}
        </h3>
        <p className="text-base lg:text-lg text-zinc-600 leading-relaxed mb-8 max-w-md">
          {feature.body}
        </p>
        <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-zinc-500 hover:text-zinc-900 transition-colors duration-150 cursor-default">
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
