import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass, Clock } from "lucide-react";
import RotatingCarousel from "@/components/RotatingCarousel";

interface HeroBannerProps {
  compact?: boolean;
  firstName?: string;
  isGuest?: boolean;
}

const HeroBanner = ({ firstName, isGuest, compact = false }: HeroBannerProps) => {
  const subtitle = isGuest
    ? 'Explore opportunities and see how the platform works.'
    : 'Track your clinical journey and find new opportunities.';

  return (
    <section className={`relative w-full overflow-hidden rounded-2xl${!compact ? " min-h-[280px] sm:min-h-[320px] lg:min-h-[340px]" : ""}`}>
      {/* No overlay — background image shows through from page layer */}

      {/* Content layer */}
      <div className={`relative z-10 flex flex-col lg:items-center h-full px-6 sm:px-10 py-10 sm:py-12 lg:py-14 gap-6 lg:gap-10 ${compact ? "lg:flex-row lg:justify-center" : "lg:flex-row lg:justify-between"}`}>
          {/* LEFT: text + CTAs */}
          <div className={`flex flex-col justify-center min-w-0 ${compact ? "items-center text-center" : "flex-1"}`}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-wide text-white leading-tight">
              {isGuest ? (
                'Welcome to ClinicalHours'
              ) : (
                <>
                  Welcome back,
                  <br />
                  <span className="font-medium">{firstName || 'there'}!</span>
                </>
              )}
            </h1>
          <p className="mt-3 text-sm sm:text-base text-white/70 max-w-md">
            {subtitle}
          </p>
          <div className={`mt-6 flex flex-wrap gap-3${compact ? " justify-center" : ""}`}>
            <Button
              asChild
              size="sm"
              className="h-9 gap-2 bg-white text-black hover:bg-white/90 rounded-lg text-sm font-medium"
            >
              <Link to="/opportunities">
                <Compass className="h-4 w-4" />
                Explore Opportunities
              </Link>
            </Button>
            {isGuest ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-white/25 text-white hover:bg-white/10 rounded-lg text-sm"
              >
                <Link to="/auth">
                  Sign Up to Get Started
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 gap-2 border-white/25 text-white hover:bg-white/10 rounded-lg text-sm"
              >
                <Link to="/hours">
                  <Clock className="h-4 w-4" />
                  Log Hours
                </Link>
              </Button>
            )}
          </div>
          </div>

          {/* RIGHT: rotating carousel */}
          {!compact && (
            <div className="lg:w-[440px] xl:w-[500px] flex-shrink-0">
              <RotatingCarousel />
            </div>
          )}
        </div>
      </section>
  );
};

export default HeroBanner;
