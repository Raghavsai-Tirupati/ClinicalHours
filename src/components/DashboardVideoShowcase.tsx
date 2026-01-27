import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardVideoShowcaseProps {
  videoSrc?: string;
  posterSrc?: string;
}

const DashboardVideoShowcase = ({ 
  videoSrc = "/screenshots/dashboard-preview.mp4",
  posterSrc = "/screenshots/dashboard.png"
}: DashboardVideoShowcaseProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasVideoLoaded, setHasVideoLoaded] = useState(false);

  // Intersection observer for visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        // Auto-play when visible
        if (entry.isIntersecting && videoRef.current && hasVideoLoaded) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasVideoLoaded]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleVideoLoad = () => {
    setHasVideoLoaded(true);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full"
    >
      {/* Squarespace-style floating browser frame */}
      <div 
        className={`relative max-w-5xl mx-auto transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Glow effect */}
        <div className="absolute -inset-2 bg-gradient-to-t from-primary/10 via-primary/5 to-transparent blur-2xl opacity-40 pointer-events-none rounded-2xl" />
        
        {/* Browser frame */}
        <div className="relative rounded-xl overflow-hidden border border-border bg-card shadow-xl">
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
          
          {/* Video container - cuts off at bottom like Squarespace */}
          <div className="relative aspect-[16/10] overflow-hidden bg-background">
            <video
              ref={videoRef}
              src={videoSrc}
              poster={posterSrc}
              muted
              loop
              playsInline
              onLoadedData={handleVideoLoad}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full h-full object-cover object-top"
            />
            
            {/* Fallback image if video doesn't exist */}
            {!hasVideoLoaded && (
              <img 
                src={posterSrc}
                alt="Dashboard Preview"
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
            )}
            
            {/* Bottom fade gradient - creates the "cut off" effect */}
            <div className="absolute bottom-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
            
            {/* Play/Pause button overlay */}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardVideoShowcase;
