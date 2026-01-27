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

// Pixels of scroll per scene transition - higher = less sensitive
const SCROLL_PER_SCENE = 300;

const FeatureShowcase = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasCompletedDown = useRef(false);
  const hasCompletedUp = useRef(false);
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

  // Intersection observer to lock based on visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Only lock if we haven't just exited
            if (!hasCompletedDown.current && !hasCompletedUp.current) {
              setIsLocked(true);
              container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else if (!entry.isIntersecting) {
            // Reset completion flags when fully out of view
            hasCompletedDown.current = false;
            hasCompletedUp.current = false;
          }
        });
      },
      { threshold: [0, 0.3, 0.5, 0.7, 1] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle wheel events when locked
  useEffect(() => {
    if (!isLocked) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = e.deltaY;
      const maxProgress = (scenes.length - 1) * 100;
      
      setScrollProgress((prev) => {
        const progressDelta = (delta / SCROLL_PER_SCENE) * 100;
        const newProgress = prev + progressDelta;
        
        // Scrolling up past first scene
        if (newProgress <= 0 && delta < 0) {
          if (prev <= 0) {
            // Already at first scene, unlock and allow normal scroll
            setIsLocked(false);
            hasCompletedUp.current = true;
            return 0;
          }
          // Clamp to 0
          setActiveIndex(0);
          return 0;
        }
        
        // Scrolling down past last scene
        if (newProgress >= maxProgress && delta > 0) {
          if (prev >= maxProgress) {
            // Already at last scene, unlock and allow normal scroll
            setIsLocked(false);
            hasCompletedDown.current = true;
            return maxProgress;
          }
          // Clamp to max
          setActiveIndex(scenes.length - 1);
          return maxProgress;
        }
        
        // Prevent default only when we're handling the scroll
        e.preventDefault();
        
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

  // Handle touch events for mobile
  useEffect(() => {
    if (!isLocked || !isMobile) return;

    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;

      const maxProgress = (scenes.length - 1) * 100;
      
      setScrollProgress((prev) => {
        const progressDelta = (deltaY / SCROLL_PER_SCENE) * 100;
        const newProgress = prev + progressDelta;
        
        if (newProgress <= 0 && deltaY < 0) {
          if (prev <= 0) {
            setIsLocked(false);
            hasCompletedUp.current = true;
            return 0;
          }
          setActiveIndex(0);
          return 0;
        }
        
        if (newProgress >= maxProgress && deltaY > 0) {
          if (prev >= maxProgress) {
            setIsLocked(false);
            hasCompletedDown.current = true;
            return maxProgress;
          }
          setActiveIndex(scenes.length - 1);
          return maxProgress;
        }
        
        e.preventDefault();
        
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
    const translateY = -sceneProgress;
    
    return `translateY(${translateY}%)`;
  };

  const getSceneOpacity = (index: number) => {
    const sceneProgress = scrollProgress - (index * 100);
    const distance = Math.abs(sceneProgress);
    return Math.max(0, 1 - (distance / 100));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[120vh] overflow-hidden"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Content container */}
      <div className="relative z-10 min-h-[120vh] flex items-center">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 py-12 md:py-20">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            
            {/* Text content */}
            <div className="order-2 lg:order-1 space-y-6 md:space-y-8 w-full">
              {/* Scene indicator */}
              <div 
                className="text-sm text-white/50 uppercase tracking-[0.3em]"
                style={{ fontWeight: 400 }}
              >
                {String(activeIndex + 1).padStart(2, "0")} / {String(scenes.length).padStart(2, "0")}
              </div>

              {/* Title with smooth vertical scroll */}
              <div className="relative min-h-[140px] md:min-h-[200px] lg:min-h-[240px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <h2
                    key={scene.id}
                    className="absolute inset-0 text-4xl md:text-6xl lg:text-7xl text-white leading-tight transition-none"
                    style={{
                      fontWeight: 300,
                      letterSpacing: '0.02em',
                      opacity: getSceneOpacity(index),
                      transform: getSceneTransform(index),
                    }}
                  >
                    {scene.title}
                  </h2>
                ))}
              </div>

              {/* Subtitle with smooth vertical scroll */}
              <div className="relative min-h-[100px] md:min-h-[120px] overflow-hidden">
                {scenes.map((scene, index) => (
                  <p
                    key={scene.id}
                    className="absolute inset-0 text-lg md:text-xl lg:text-2xl text-white/60 leading-relaxed max-w-xl transition-none"
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
              <div className="pt-4 md:pt-6">
                <Link
                  to={activeScene.ctaHref}
                  className="group inline-flex items-center gap-3 text-sm md:text-base uppercase tracking-widest px-8 md:px-10 py-4 md:py-5 bg-white text-black hover:bg-white/90 transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  <span>{activeScene.ctaText}</span>
                  <svg 
                    className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition-transform"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>

              {/* Navigation dots */}
              <div className="flex items-center gap-3 pt-6 md:pt-8">
                {scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    onClick={() => goToScene(index)}
                    className={`relative h-2 md:h-3 rounded-full cursor-pointer transition-all duration-300 ${
                      activeIndex === index 
                        ? "w-10 md:w-12 bg-white" 
                        : "w-2 md:w-3 bg-white/30 hover:bg-white/50"
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

            {/* Device frame with screenshot - LARGER */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end w-full">
              <div className="relative w-full max-w-3xl lg:max-w-4xl">
                {/* Device frame container */}
                <div 
                  className="relative rounded-xl md:rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    boxShadow: "0 50px 100px -20px rgba(0, 0, 0, 0.5), 0 30px 60px -30px rgba(0, 0, 0, 0.6)",
                  }}
                >
                  {/* Browser-style top bar */}
                  <div className="bg-gray-900/80 backdrop-blur px-3 md:px-4 py-2 md:py-3 flex items-center gap-2">
                    <div className="flex gap-1 md:gap-1.5">
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-red-500/80" />
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 ml-3 md:ml-4">
                      <div className="bg-gray-800 rounded-md px-2 md:px-3 py-1 text-xs text-gray-400 max-w-xs">
                        clinicalhours.org
                      </div>
                    </div>
                  </div>

                  {/* Screenshot images with smooth vertical scroll - LARGER */}
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
          className="p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
          aria-label="Previous scene"
          disabled={activeIndex === 0}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={() => goToScene(activeIndex + 1)}
          className="p-4 border border-white/20 hover:border-white hover:bg-white hover:text-black text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
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
