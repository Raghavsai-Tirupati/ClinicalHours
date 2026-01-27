import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoItem {
  src: string;
  poster: string;
}

const videos: VideoItem[] = [
  {
    src: "/screenshots/dashboard-preview.mp4",
    poster: "/screenshots/dashboard.png"
  },
  {
    src: "/screenshots/dashboard-preview2.mp4",
    poster: "/screenshots/dashboard.png" // Placeholder until uploaded
  },
  {
    src: "/screenshots/dashboard-preview3.mp4",
    poster: "/screenshots/dashboard.png" // Placeholder until uploaded
  },
  {
    src: "/screenshots/dashboard-preview4.mp4",
    poster: "/screenshots/dashboard.png" // Placeholder until uploaded
  }
];

const DashboardVideoCarousel = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [loadedVideos, setLoadedVideos] = useState<Set<number>>(new Set());

  // Intersection observer for visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && videoRefs.current[currentIndex]) {
          videoRefs.current[currentIndex]?.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [currentIndex]);

  // Handle video end - rotate to next
  const handleVideoEnded = () => {
    const nextIndex = (currentIndex + 1) % videos.length;
    setCurrentIndex(nextIndex);
    
    // Play the next video after a brief transition
    setTimeout(() => {
      if (isVisible && videoRefs.current[nextIndex]) {
        videoRefs.current[nextIndex]?.play().catch(() => {});
        setIsPlaying(true);
      }
    }, 500);
  };

  const handleVideoLoad = (index: number) => {
    setLoadedVideos(prev => new Set(prev).add(index));
  };

  const togglePlay = () => {
    const video = videoRefs.current[currentIndex];
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Calculate positions for the carousel items - symmetric layout with items on both sides
  const getItemStyle = (index: number): React.CSSProperties => {
    const diff = index - currentIndex;
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
      className="relative w-full overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      <div 
        className={`relative h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] flex items-center justify-center transition-all duration-700 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {videos.map((video, index) => {
          const style = getItemStyle(index);
          const isActive = index === currentIndex;
          
          return (
            <div
              key={index}
              className="w-[85%] sm:w-[75%] md:w-[65%] lg:w-[55%] max-w-4xl transition-all duration-700 ease-out"
              style={{
                ...style,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              {/* Browser frame */}
              <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-2xl">
                {/* Browser header */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="flex-1 mx-3">
                    <div className="max-w-xs mx-auto bg-background/50 rounded-md px-3 py-1 flex items-center justify-center border border-border/50">
                      <span className="text-[10px] sm:text-xs text-muted-foreground truncate">clinicalhours.org</span>
                    </div>
                  </div>
                  <div className="w-12" />
                </div>
                
                {/* Video container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-background">
                  <video
                    ref={(el) => { videoRefs.current[index] = el; }}
                    src={video.src}
                    poster={video.poster}
                    muted
                    playsInline
                    onLoadedData={() => handleVideoLoad(index)}
                    onEnded={isActive ? handleVideoEnded : undefined}
                    onPlay={() => isActive && setIsPlaying(true)}
                    onPause={() => isActive && setIsPlaying(false)}
                    className="w-full h-full object-cover object-top"
                  />
                  
                  {/* Fallback poster */}
                  {!loadedVideos.has(index) && (
                    <img 
                      src={video.poster}
                      alt="Dashboard Preview"
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  )}
                  
                  {/* Bottom fade gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
                  
                  {/* Play/Pause button - only on active item */}
                  {isActive && (
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={togglePlay}
                      className="absolute bottom-6 right-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex 
                ? "bg-primary w-6" 
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default DashboardVideoCarousel;
