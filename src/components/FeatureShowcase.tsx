import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Link } from "react-router-dom";

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
    id: "opportunities",
    title: "Discover Real Opportunities",
    subtitle: "Browse thousands of clinical positions sorted by distance. Filter by type and add promising ones to your tracker.",
    ctaText: "Browse Opportunities",
    ctaHref: "/opportunities",
    // Warm charcoal gradient
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
    // Deep teal to dark gradient
    bgGradient: "linear-gradient(135deg, #042f2e 0%, #134e4a 50%, #0f766e 100%)",
    imageSrc: "/screenshots/map.png",
    imageAlt: "Interactive map showing clinical opportunities near user location",
  },
  {
    id: "profile",
    title: "Personalize Your Experience",
    subtitle: "Keep your information updated. Get tailored recommendations and track your total hours automatically.",
    ctaText: "Edit Profile",
    ctaHref: "/settings",
    // Deep purple to slate gradient
    bgGradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)",
    imageSrc: "/screenshots/profile.png",
    imageAlt: "User profile page with settings and hour tracking",
  },
];

// Auto-rotate interval in milliseconds (adjust timing here)
const AUTO_ROTATE_INTERVAL = 7000; // 7 seconds per scene

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const goToScene = useCallback((index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
  }, [activeIndex]);

  const nextScene = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % scenes.length);
  }, []);

  // Auto-rotate when reduced motion not preferred
  useEffect(() => {
    if (prefersReducedMotion) return;
    
    const interval = setInterval(nextScene, AUTO_ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [prefersReducedMotion, nextScene]);

  const activeScene = scenes[activeIndex];
  
  // Transition classes based on motion preference
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

              {/* Title with crossfade */}
              <div className="relative min-h-[120px] md:min-h-[160px]">
                {scenes.map((scene, index) => (
                  <h2
                    key={scene.id}
                    className={`absolute inset-0 text-4xl md:text-5xl lg:text-6xl text-white leading-tight ${transitionClass}`}
                    style={{
                      fontWeight: 400,
                      opacity: activeIndex === index ? 1 : 0,
                      transform: activeIndex === index 
                        ? "translateY(0)" 
                        : prefersReducedMotion ? "translateY(0)" : "translateY(20px)",
                    }}
                  >
                    {scene.title}
                  </h2>
                ))}
              </div>

              {/* Subtitle with crossfade */}
              <div className="relative min-h-[80px]">
                {scenes.map((scene, index) => (
                  <p
                    key={scene.id}
                    className={`absolute inset-0 text-lg md:text-xl text-white/60 leading-relaxed max-w-lg ${transitionClass}`}
                    style={{
                      fontWeight: 400,
                      opacity: activeIndex === index ? 1 : 0,
                      transform: activeIndex === index 
                        ? "translateY(0)" 
                        : prefersReducedMotion ? "translateY(0)" : "translateY(20px)",
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

              {/* Navigation dots */}
              <div className="flex items-center gap-3 pt-8">
                {scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    onClick={() => goToScene(index)}
                    className={`relative h-3 rounded-full ${transitionClass} ${
                      activeIndex === index 
                        ? "w-10 bg-white" 
                        : "w-3 bg-white/30 hover:bg-white/50"
                    }`}
                    aria-label={`Go to ${scene.title}`}
                    aria-current={activeIndex === index ? "true" : "false"}
                  />
                ))}
              </div>
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

                  {/* Screenshot images with crossfade */}
                  <div className="relative" style={{ aspectRatio: "16/10" }}>
                    {scenes.map((scene, index) => (
                      <img
                        key={scene.id}
                        src={scene.imageSrc}
                        alt={scene.imageAlt}
                        width={1920}
                        height={1200}
                        decoding="async"
                        loading={index === 0 ? "eager" : "lazy"}
                        onError={(e) => {
                          // Hide gracefully if the screenshot asset is missing
                          // so the broken-image alt text does not render over
                          // the device frame.
                          e.currentTarget.style.display = 'none';
                        }}
                        className={`absolute inset-0 w-full h-full object-cover object-top ${transitionClass}`}
                        style={{
                          opacity: activeIndex === index ? 1 : 0,
                          transform: activeIndex === index
                            ? "scale(1)"
                            : prefersReducedMotion ? "scale(1)" : "scale(1.02)",
                        }}
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
          onClick={() => goToScene((activeIndex - 1 + scenes.length) % scenes.length)}
          className={`p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white ${transitionClass}`}
          aria-label="Previous scene"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => goToScene((activeIndex + 1) % scenes.length)}
          className={`p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white ${transitionClass}`}
          aria-label="Next scene"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default memo(FeatureShowcase);
