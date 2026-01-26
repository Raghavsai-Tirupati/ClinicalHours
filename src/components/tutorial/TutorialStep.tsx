import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TutorialStepProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  isActive: boolean;
  prefersReducedMotion: boolean;
}

export default function TutorialStep({
  icon: Icon,
  title,
  subtitle,
  description,
  features,
  isActive,
  prefersReducedMotion,
}: TutorialStepProps) {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isActive && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isActive, hasAnimated]);

  const shouldAnimate = isActive || hasAnimated;
  const transition = prefersReducedMotion ? 'none' : 'all 800ms cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 md:px-12">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        {/* Icon */}
        <div
          className="mx-auto"
          style={{
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'scale(1)' : 'scale(0.8)',
            transition,
            transitionDelay: prefersReducedMotion ? '0ms' : '0ms',
          }}
        >
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto">
            <Icon className="w-10 h-10 md:w-14 md:h-14 text-white/80" strokeWidth={1.5} />
          </div>
        </div>

        {/* Subtitle */}
        <p
          className="text-xs md:text-sm uppercase tracking-[0.3em] text-white/40"
          style={{
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0)' : 'translateY(10px)',
            transition,
            transitionDelay: prefersReducedMotion ? '0ms' : '100ms',
          }}
        >
          {subtitle}
        </p>

        {/* Title */}
        <h2
          className="text-3xl md:text-5xl lg:text-6xl text-white font-light"
          style={{
            fontFamily: '"Times New Roman", Times, serif',
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0)' : 'translateY(20px)',
            transition,
            transitionDelay: prefersReducedMotion ? '0ms' : '200ms',
          }}
        >
          {title}
        </h2>

        {/* Description */}
        <p
          className="text-base md:text-lg text-white/50 leading-relaxed max-w-xl mx-auto"
          style={{
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0)' : 'translateY(20px)',
            transition,
            transitionDelay: prefersReducedMotion ? '0ms' : '300ms',
          }}
        >
          {description}
        </p>

        {/* Features */}
        <div
          className="flex flex-wrap justify-center gap-3 pt-4"
          style={{
            opacity: shouldAnimate ? 1 : 0,
            transform: shouldAnimate ? 'translateY(0)' : 'translateY(20px)',
            transition,
            transitionDelay: prefersReducedMotion ? '0ms' : '400ms',
          }}
        >
          {features.map((feature, index) => (
            <span
              key={index}
              className="px-4 py-2 text-xs md:text-sm text-white/70 bg-white/[0.05] border border-white/10 rounded-full"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
