import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface Scene {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
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
    imageSrc: "/screenshots/dashboard.png",
    imageAlt: "Clinical Hours Dashboard showing saved opportunities and progress tracking",
  },
  {
    id: "opportunities",
    title: "Discover Real Opportunities",
    subtitle: "Browse thousands of clinical positions sorted by distance. Filter by type and add promising ones to your tracker.",
    ctaText: "Browse Opportunities",
    ctaHref: "/opportunities",
    imageSrc: "/screenshots/opportunities.png",
    imageAlt: "Opportunities page showing clinical volunteer positions",
  },
  {
    id: "map",
    title: "Visualize What's Near You",
    subtitle: "Explore opportunities on an interactive map. Set your radius and see clusters of positions in your area.",
    ctaText: "Open Map",
    ctaHref: "/map",
    imageSrc: "/screenshots/map.png",
    imageAlt: "Interactive map showing clinical opportunities near user location",
  },
  {
    id: "profile",
    title: "Personalize Your Experience",
    subtitle: "Keep your information updated. Get tailored recommendations and track your total hours automatically.",
    ctaText: "Edit Profile",
    ctaHref: "/profile",
    imageSrc: "/screenshots/profile.png",
    imageAlt: "User profile page with settings and hour tracking",
  },
];

// Pixels of scroll per scene transition
const SCROLL_PER_SCENE = 150;

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to (scenes.length - 1) * 100
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
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
    const clampedIndex = Math.max(0, Math.min(scenes.length - 1, index));
    setActiveIndex(clampedIndex);
    setScrollProgress(clampedIndex * 100);
  }, []);

  // Intersection observer to lock/unlock based on visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Lock when more than 60% visible
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            setIsLocked(true);
            // Scroll to center when locking
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      },
      { threshold: [0, 0.3, 0.6, 0.9, 1] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle wheel events when locked - smooth continuous scrolling
  useEffect(() => {
    if (!isLocked) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Calculate new progress based on scroll delta
      const delta = e.deltaY;
      const progressDelta = (delta / SCROLL_PER_SCENE) * 100;
      
      setScrollProgress((prev) => {
        const newProgress = prev + progressDelta;
        const maxProgress = (scenes.length - 1) * 100;
        
        // Check if we should unlock
        if (newProgress < -20) {
          // Scrolling up past first scene
          setIsLocked(false);
          return 0;
        }
        if (newProgress > maxProgress + 20) {
          // Scrolling down past last scene
          setIsLocked(false);
          return maxProgress;
        }
        
        // Clamp within bounds
        const clamped = Math.max(0, Math.min(maxProgress, newProgress));
        
        // Update active index based on progress
        const newIndex = Math.round(clamped / 100);
        setActiveIndex(newIndex);
        
        return clamped;
      });
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isLocked]);

  // Handle touch events for mobile - smooth continuous scrolling
  useEffect(() => {
    if (!isLocked || !isMobile) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      const progressDelta = (deltaY / SCROLL_PER_SCENE) * 100;
      
      setScrollProgress((prev) => {
        const newProgress = prev + progressDelta;
        const maxProgress = (scenes.length - 1) * 100;
        
        if (newProgress < -20) {
          setIsLocked(false);
          return 0;
        }
        if (newProgress > maxProgress + 20) {
          setIsLocked(false);
          return maxProgress;
        }
        
        const clamped = Math.max(0, Math.min(maxProgress, newProgress));
        const newIndex = Math.round(clamped / 100);
        setActiveIndex(newIndex);
        
        return clamped;
      });
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isLocked, isMobile]);

  const activeScene = scenes[activeIndex];
  
  // Calculate continuous transform based on scroll progress
  const getSceneTransform = (index: number) => {
    if (prefersReducedMotion) return "translateY(0)";
    
    const sceneProgress = scrollProgress - (index * 100);
    // Each scene moves from 100% (below) to 0% (visible) to -100% (above)
    const translateY = -sceneProgress;
    
    return `translateY(${translateY}%)`;
  };

  const getSceneOpacity = (index: number) => {
    const sceneProgress = scrollProgress - (index * 100);
    // Full opacity when at 0, fade out as we move away
    const distance = Math.abs(sceneProgress);
    return Math.max(0, 1 - (distance / 100));
  };

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
                className="text-xs text-white/40 uppercase tracking-[0.3em]"
                style={{ fontWeight: 400 }}
              >
                {String(activeIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
              </div>

              {/* Title with smooth vertical scroll */}
              <div className="relative min-h-[120px] md:min-h-[160px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <h2
                    key={scene.id}
                    className="absolute inset-0 text-4xl md:text-5xl lg:text-6xl text-white leading-tight transition-none"
                    style={{
                      fontWeight: 400,
                      opacity: getSceneOpacity(index),
                      transform: getSceneTransform(index),
                    }}
                  >
                    {scene.title}
                  </h2>
                ))}
              </div>

              {/* Subtitle with smooth vertical scroll */}
              <div className="relative min-h-[80px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <p
                    key={scene.id}
                    className="absolute inset-0 text-lg md:text-xl text-white/60 leading-relaxed max-w-lg transition-none"
                    style={{
                      fontWeight: 400,
                      opacity: getSceneOpacity(index),
                      transform: getSceneTransform(index),
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
                  className="group inline-flex items-center gap-3 text-sm uppercase tracking-widest px-8 py-4 bg-white text-black hover:bg-white/90 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <span>{activeScene.ctaText}</span>
                  <svg 
                    className="w-4 h-4 group-hover:translate-x-1 transition-transform"
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
                  <div
                    key={scene.id}
                    onClick={() => goToScene(index)}
                    className={`relative h-2 rounded-full cursor-pointer transition-all duration-300 ${
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
                  className="relative rounded-2xl overflow-hidden shadow-2xl"
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

                  {/* Screenshot images with smooth vertical scroll */}
                  <div className="relative overflow-hidden" style={{ aspectRatio: "16/10" }}>
                    {scenes.map((scene, index) => (
                      <img
                        key={scene.id}
                        src={scene.imageSrc}
                        alt={scene.imageAlt}
                        className="absolute inset-0 w-full h-full object-cover object-top transition-none"
                        style={{
                          opacity: getSceneOpacity(index),
                          transform: getSceneTransform(index),
                        }}
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    ))}
                  </div>
                </div>

                {/* Subtle glow effect */}
                <div className="absolute -inset-4 rounded-3xl opacity-20 blur-3xl -z-10 bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Arrow navigation - Desktop only */}
      <div className="absolute bottom-8 right-8 hidden lg:flex gap-3 z-20">
        <button
          onClick={() => goToScene(activeIndex - 1)}
          className="p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white transition-all"
          aria-label="Previous scene"
          disabled={activeIndex === 0}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => goToScene(activeIndex + 1)}
          className="p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white transition-all"
          aria-label="Next scene"
          disabled={activeIndex === scenes.length - 1}
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
