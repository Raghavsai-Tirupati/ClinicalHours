import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface VideoItem {
  src: string;
  poster: string;
}

const videos: VideoItem[] = [
  {
    src: "/screenshots/dashboard-preview.mp4",
    poster: "/screenshots/opportunities.png"
  },
  {
    src: "/screenshots/dashboard-preview.mp4",
    poster: "/screenshots/opportunities.png"
  },
  {
    src: "/screenshots/dashboard-preview2.mp4",
    poster: "/screenshots/opportunities.png"
  },
  {
    src: "/screenshots/dashboard-preview3.mp4",
    poster: "/screenshots/map.png"
  },
  {
    src: "/screenshots/dashboard-preview4.mp4",
    poster: "/screenshots/profile.png"
  }
];

interface HeroBrowserCarouselProps {
  // External control - which index should be active (synced with hero video)
  activeIndex: number;
}

const HeroBrowserCarousel = ({ activeIndex }: HeroBrowserCarouselProps) => {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());
  const [internalIndex, setInternalIndex] = useState(activeIndex);
  const lastExternalIndex = useRef(activeIndex);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with external index when it changes
  useEffect(() => {
    if (activeIndex !== lastExternalIndex.current) {
      lastExternalIndex.current = activeIndex;
      setInternalIndex(activeIndex);
    }
  }, [activeIndex]);

  // Fallback: auto-advance if external index doesn't change (for mobile)
  useEffect(() => {
    fallbackTimerRef.current = setInterval(() => {
      if (lastExternalIndex.current === activeIndex) {
        setInternalIndex(prev => (prev + 1) % videos.length);
      }
    }, 8000);

    return () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
      }
    };
  }, [activeIndex]);

  // Play active video when index changes
  useEffect(() => {
    // Pause all videos first
    videoRefs.current.forEach((video, idx) => {
      if (video && idx !== internalIndex) {
        video.pause();
        video.currentTime = 0;
      }
    });

    // Play the active one
    const activeVideo = videoRefs.current[internalIndex];
    if (activeVideo) {
      activeVideo.currentTime = 0;
      activeVideo.play().catch(() => {});
    }
  }, [internalIndex]);

  const handleVideoLoad = (index: number) => {
    setLoadedVideos(prev => new Set(prev).add(index));
    // Try to play immediately when loaded
    if (index === internalIndex) {
      const video = videoRefs.current[index];
      if (video) {
        video.play().catch(() => {});
      }
    }
  };

  // iOS Safari fix: play videos on first user interaction
  useEffect(() => {
    const playVideosOnInteraction = () => {
      const activeVideo = videoRefs.current[internalIndex];
      if (activeVideo) {
        activeVideo.play().catch(() => {});
      }
    };

    document.addEventListener('touchstart', playVideosOnInteraction, { once: true });
    document.addEventListener('click', playVideosOnInteraction, { once: true });

    return () => {
      document.removeEventListener('touchstart', playVideosOnInteraction);
      document.removeEventListener('click', playVideosOnInteraction);
    };
  }, [internalIndex]);

  // Calculate positions for the carousel items - simplified for mobile
  const getItemStyle = (index: number): React.CSSProperties => {
    const diff = index - internalIndex;
    const totalItems = videos.length;
    
    // Normalize the difference to handle wrap-around (-2 to +2 for 4 items)
    let normalizedDiff = diff;
    if (diff > totalItems / 2) normalizedDiff = diff - totalItems;
    if (diff < -totalItems / 2) normalizedDiff = diff + totalItems;

    const baseStyle: React.CSSProperties = {
      position: "absolute" as const,
      left: "50%",
      top: "50%",
      willChange: "transform, opacity",
    };

    // Simplified mobile layout - no 3D rotation, just fade between
    if (isMobile) {
      if (normalizedDiff === 0) {
        return {
          ...baseStyle,
          transform: "translate(-50%, -50%) scale(1)",
          zIndex: 30,
          opacity: 1,
        };
      } else {
        return {
          ...baseStyle,
          transform: "translate(-50%, -50%) scale(0.9)",
          zIndex: 0,
          opacity: 0,
          pointerEvents: "none" as const,
        };
      }
    }

    // Desktop 3D carousel
    if (normalizedDiff === 0) {
      // Center (active)
      return {
        ...baseStyle,
        transform: "translate(-50%, -50%) scale(1) rotateY(0deg)",
        zIndex: 30,
        opacity: 1,
        filter: "brightness(1)"
      };
    } else if (normalizedDiff === 1) {
      // Right side
      return {
        ...baseStyle,
        transform: "translate(15%, -50%) scale(0.8) rotateY(-12deg)",
        zIndex: 20,
        opacity: 0.7,
        filter: "brightness(0.7)"
      };
    } else if (normalizedDiff === -1) {
      // Left side
      return {
        ...baseStyle,
        transform: "translate(-115%, -50%) scale(0.8) rotateY(12deg)",
        zIndex: 20,
        opacity: 0.7,
        filter: "brightness(0.7)"
      };
    } else {
      // Hide the 4th video completely
      return {
        ...baseStyle,
        transform: "translate(-50%, -50%) scale(0.5)",
        zIndex: 0,
        opacity: 0,
        filter: "brightness(0.5)"
      };
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden md:overflow-visible"
      style={{ perspective: isMobile ? "none" : "1200px" }}
    >
      <style>{`
        .carousel-video::-webkit-media-controls,
        .carousel-video::-webkit-media-controls-enclosure,
        .carousel-video::-webkit-media-controls-panel,
        .carousel-video::-webkit-media-controls-play-button,
        .carousel-video::-webkit-media-controls-start-playback-button,
        .carousel-video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `}</style>
      <div className="relative h-[280px] sm:h-[350px] md:h-[450px] lg:h-[500px] flex items-center justify-center">
        {videos.map((video, index) => {
          const style = getItemStyle(index);
          const isActive = index === internalIndex;
          
          return (
            <div
              key={index}
              className="w-[90%] sm:w-[75%] md:w-[65%] lg:w-[55%] max-w-4xl transition-all duration-500 ease-out"
              style={{
                ...style,
                transformStyle: isMobile ? "flat" : "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              {/* Browser frame */}
              <div className="relative rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shadow-2xl shadow-black/50">
                {/* Browser header */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-800/80 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-2 sm:mx-3">
                    <div className="max-w-xs mx-auto bg-zinc-700/50 rounded-md px-2 sm:px-3 py-1 flex items-center justify-center border border-white/5">
                      <span className="text-[9px] sm:text-xs text-white/50 truncate">clinicalhours.org</span>
                    </div>
                  </div>
                  <div className="w-8 sm:w-12" />
                </div>
                
                {/* Video container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
                    <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    src={video.src}
                    poster={video.poster}
                    muted
                    playsInline
                    autoPlay={isActive}
                    loop
                    controls={false}
                    disablePictureInPicture
                    preload={isActive ? "auto" : "metadata"}
                    onLoadedData={() => handleVideoLoad(index)}
                    className="carousel-video w-full h-full object-cover object-top pointer-events-none"
                    style={{ WebkitAppearance: 'none' }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === internalIndex
                ? "bg-white w-6"
                : "bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroBrowserCarousel;
