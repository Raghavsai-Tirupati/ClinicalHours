import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * SCENES CONFIGURATION
 * =====================
 * To update scenes, modify this array:
 * - title: Main headline text
 * - subtitle: Description text
 * - ctaText: Button text
 * - ctaHref: Button link destination
 * - bgGradient: CSS gradient for background (full-bleed)
 * - imageSrc: Path to screenshot image
 * - imageAlt: Alt text for accessibility
 */
interface Scene {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  bgGradient: string;
  imageSrc: string;
  imageAlt: string;
}

const scenes: Scene[] = [
  {
    id: "dashboard",
    title: "Your Clinical Journey, Organized",
    subtitle: "Track saved opportunities, monitor your progress, and manage applications all in one powerful dashboard.",
    ctaText: "View Dashboard",
    ctaHref: "/dashboard",
    bgGradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    imageSrc: "/screenshots/dashboard.png",
    imageAlt: "Clinical Hours Dashboard showing saved opportunities and progress tracking",
  },
  {
    id: "opportunities",
    title: "Discover Real Opportunities",
    subtitle: "Browse thousands of clinical positions sorted by distance. Filter by type and add promising ones to your tracker.",
    ctaText: "Browse Opportunities",
    ctaHref: "/opportunities",
    bgGradient: "linear-gradient(135deg, #1c1917 0%, #292524 50%, #44403c 100%)",
    imageSrc: "/screenshots/opportunities.png",
    imageAlt: "Opportunities page showing clinical volunteer positions",
  },
  {
    id: "map",
    title: "Visualize What's Near You",
    subtitle: "Explore opportunities on an interactive map. Set your radius and see clusters of positions in your area.",
    ctaText: "Open Map",
    ctaHref: "/map",
    bgGradient: "linear-gradient(135deg, #042f2e 0%, #134e4a 50%, #0f766e 100%)",
    imageSrc: "/screenshots/map.png",
    imageAlt: "Interactive map showing clinical opportunities near user location",
  },
  {
    id: "profile",
    title: "Personalize Your Experience",
    subtitle: "Keep your information updated. Get tailored recommendations and track your total hours automatically.",
    ctaText: "Edit Profile",
    ctaHref: "/profile",
    bgGradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)",
    imageSrc: "/screenshots/profile.png",
    imageAlt: "User profile page with settings and hour tracking",
  },
];

// Scroll threshold to trigger scene change
const SCROLL_THRESHOLD = 80;

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAccumulator = useRef(0);
  const isTransitioning = useRef(false);
  const hasEnteredFromTop = useRef(false);
  const hasExitedFromBottom = useRef(false);
  const isMobile = useIsMobile();

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const goToScene = useCallback((index: number) => {
    if (index === activeIndex || isTransitioning.current) return;
    isTransitioning.current = true;
    setActiveIndex(index);
    
    // Reset transition lock after animation
    setTimeout(() => {
      isTransitioning.current = false;
    }, 700);
  }, [activeIndex]);

  const nextScene = useCallback(() => {
    if (activeIndex < scenes.length - 1) {
      goToScene(activeIndex + 1);
      return true;
    }
    return false;
  }, [activeIndex, goToScene]);

  const prevScene = useCallback(() => {
    if (activeIndex > 0) {
      goToScene(activeIndex - 1);
      return true;
    }
    return false;
  }, [activeIndex, goToScene]);

  // Scroll-hijacking logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const containerCenter = rect.top + rect.height / 2;
      const viewportCenter = viewportHeight / 2;
      
      // Check if container is centered in viewport (with some tolerance)
      const tolerance = viewportHeight * 0.3;
      const isCentered = Math.abs(containerCenter - viewportCenter) < tolerance;
      
      // Enter lock when scrolling down into center
      if (isCentered && !isLocked && !hasExitedFromBottom.current) {
        if (rect.top < viewportCenter && !hasEnteredFromTop.current) {
          hasEnteredFromTop.current = true;
          setIsLocked(true);
        }
      }
      
      // Reset flags when scrolled away
      if (rect.bottom < 0 || rect.top > viewportHeight) {
        hasEnteredFromTop.current = false;
        hasExitedFromBottom.current = false;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLocked]);

  // Handle wheel events when locked
  useEffect(() => {
    if (!isLocked) return;

    const handleWheel = (e: WheelEvent) => {
      if (isTransitioning.current) {
        e.preventDefault();
        return;
      }

      scrollAccumulator.current += e.deltaY;

      if (scrollAccumulator.current > SCROLL_THRESHOLD) {
        // Scrolling down
        scrollAccumulator.current = 0;
        if (!nextScene()) {
          // At last scene, unlock and allow normal scroll
          setIsLocked(false);
          hasExitedFromBottom.current = true;
        } else {
          e.preventDefault();
        }
      } else if (scrollAccumulator.current < -SCROLL_THRESHOLD) {
        // Scrolling up
        scrollAccumulator.current = 0;
        if (!prevScene()) {
          // At first scene, unlock and allow normal scroll
          setIsLocked(false);
          hasEnteredFromTop.current = false;
        } else {
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isLocked, nextScene, prevScene]);

  // Handle touch events for mobile
  useEffect(() => {
    if (!isLocked || !isMobile) return;

    let touchStartY = 0;
    let touchAccumulator = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchAccumulator = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTransitioning.current) {
        e.preventDefault();
        return;
      }

      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchAccumulator += deltaY;
      touchStartY = touchY;

      if (touchAccumulator > SCROLL_THRESHOLD) {
        touchAccumulator = 0;
        if (!nextScene()) {
          setIsLocked(false);
          hasExitedFromBottom.current = true;
        } else {
          e.preventDefault();
        }
      } else if (touchAccumulator < -SCROLL_THRESHOLD) {
        touchAccumulator = 0;
        if (!prevScene()) {
          setIsLocked(false);
          hasEnteredFromTop.current = false;
        } else {
          e.preventDefault();
        }
      } else {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isLocked, isMobile, nextScene, prevScene]);

  const activeScene = scenes[activeIndex];
  
  // Transition classes based on motion preference - now vertical
  const transitionClass = prefersReducedMotion 
    ? "" 
    : "transition-all duration-700 ease-out";

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Content container */}
      <div className="relative z-10 min-h-screen flex items-center">
        <div className="container mx-auto px-6 lg:px-12 py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Text content - Left side on desktop, top on mobile */}
            <div className="order-1 lg:order-1 space-y-8">
              {/* Scene indicator */}
              <div 
                className={`text-xs text-white/40 uppercase tracking-[0.3em] ${transitionClass}`}
                style={{ fontWeight: 400 }}
              >
                {String(activeIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
              </div>

              {/* Title with vertical crossfade */}
              <div className="relative min-h-[120px] md:min-h-[160px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <h2
                    key={scene.id}
                    className={`absolute inset-0 text-4xl md:text-5xl lg:text-6xl text-white leading-tight ${transitionClass}`}
                    style={{
                      fontWeight: 400,
                      opacity: activeIndex === index ? 1 : 0,
                      transform: activeIndex === index 
                        ? "translateY(0)" 
                        : activeIndex > index 
                          ? (prefersReducedMotion ? "translateY(0)" : "translateY(-100%)")
                          : (prefersReducedMotion ? "translateY(0)" : "translateY(100%)"),
                    }}
                  >
                    {scene.title}
                  </h2>
                ))}
              </div>

              {/* Subtitle with vertical crossfade */}
              <div className="relative min-h-[80px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <p
                    key={scene.id}
                    className={`absolute inset-0 text-lg md:text-xl text-white/60 leading-relaxed max-w-lg ${transitionClass}`}
                    style={{
                      fontWeight: 400,
                      opacity: activeIndex === index ? 1 : 0,
                      transform: activeIndex === index 
                        ? "translateY(0)" 
                        : activeIndex > index 
                          ? (prefersReducedMotion ? "translateY(0)" : "translateY(-100%)")
                          : (prefersReducedMotion ? "translateY(0)" : "translateY(100%)"),
                      transitionDelay: prefersReducedMotion ? "0ms" : "100ms",
                    }}
                  >
                    {scene.subtitle}
                  </p>
                ))}
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                <Link
                  to={activeScene.ctaHref}
                  className={`group inline-flex items-center gap-3 text-sm uppercase tracking-widest px-8 py-4 bg-white text-black hover:bg-white/90 ${transitionClass}`}
                  style={{ fontWeight: 500 }}
                >
                  <span>{activeScene.ctaText}</span>
                  <svg 
                    className={`w-4 h-4 ${prefersReducedMotion ? "" : "group-hover:translate-x-1 transition-transform"}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>

              {/* Navigation dots - now vertical progress indicator */}
              <div className="flex items-center gap-3 pt-8">
                {scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    onClick={() => goToScene(index)}
                    className={`relative h-2 rounded-full cursor-pointer ${transitionClass} ${
                      activeIndex === index 
                        ? "w-8 bg-white" 
                        : "w-2 bg-white/30 hover:bg-white/50"
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Go to ${scene.title}`}
                    aria-current={activeIndex === index ? "true" : "false"}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        goToScene(index);
                      }
                    }}
                  />
                ))}
              </div>

              {/* Scroll hint when locked */}
              {isLocked && (
                <div className="flex items-center gap-2 text-white/40 text-sm animate-pulse">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span>Scroll to explore</span>
                </div>
              )}
            </div>

            {/* Device frame with screenshot - Right side on desktop, bottom on mobile */}
            <div className="order-2 lg:order-2 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-2xl">
                {/* Device frame container */}
                <div 
                  className={`relative rounded-2xl overflow-hidden shadow-2xl ${transitionClass}`}
                  style={{
                    boxShadow: "0 50px 100px -20px rgba(0, 0, 0, 0.5), 0 30px 60px -30px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  {/* Browser-style top bar */}
                  <div className="bg-gray-900/80 backdrop-blur px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 ml-4">
                      <div className="bg-gray-800 rounded-md px-3 py-1 text-xs text-gray-400 max-w-xs">
                        clinicalhours.org
                      </div>
                    </div>
                  </div>

                  {/* Screenshot images with vertical crossfade */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                    {scenes.map((scene, index) => (
                      <img
                        key={scene.id}
                        src={scene.imageSrc}
                        alt={scene.imageAlt}
                        className={`absolute inset-0 w-full h-full object-cover object-top ${transitionClass}`}
                        style={{
                          opacity: activeIndex === index ? 1 : 0,
                          transform: activeIndex === index 
                            ? "translateY(0)" 
                            : activeIndex > index 
                              ? (prefersReducedMotion ? "translateY(0)" : "translateY(-100%)")
                              : (prefersReducedMotion ? "translateY(0)" : "translateY(100%)"),
                        }}
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    ))}
                  </div>
                </div>

                {/* Subtle glow effect */}
                <div 
                  className={`absolute -inset-4 rounded-3xl opacity-20 blur-3xl -z-10 bg-white/10`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Arrow navigation - Desktop only */}
      <div className="absolute bottom-8 right-8 hidden lg:flex gap-3 z-20">
        <button
          onClick={() => prevScene()}
          className={`p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white ${transitionClass}`}
          aria-label="Previous scene"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => nextScene()}
          className={`p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white ${transitionClass}`}
          aria-label="Next scene"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FeatureShowcase;
