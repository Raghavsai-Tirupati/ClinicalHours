import { useState, useEffect, useRef } from "react";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroVideo4 from "@/assets/hero-video-4.mp4";

const videos = [heroVideo1, heroVideo2, heroVideo3, heroVideo4];

const HeroVideoCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const currentVideo = currentVideoRef.current;
    if (!currentVideo) return;

    const handleVideoEnd = () => {
      // Start transition
      setIsTransitioning(true);
      
      // After transition completes, update indices
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setNextIndex((nextIndex + 1) % videos.length);
        setIsTransitioning(false);
      }, 1200); // Match transition duration
    };

    currentVideo.addEventListener("ended", handleVideoEnd);
    return () => currentVideo.removeEventListener("ended", handleVideoEnd);
  }, [nextIndex]);

  // Preload next video
  useEffect(() => {
    const nextVideo = nextVideoRef.current;
    if (nextVideo) {
      nextVideo.load();
    }
  }, [nextIndex]);

  // Auto-play current video when index changes
  useEffect(() => {
    const currentVideo = currentVideoRef.current;
    if (currentVideo && !isTransitioning) {
      currentVideo.currentTime = 0;
      currentVideo.play().catch(() => {});
    }
  }, [currentIndex, isTransitioning]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Current Video */}
      <div 
        className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
          isTransitioning ? "opacity-0 -translate-x-full" : "opacity-100 translate-x-0"
        }`}
      >
        <video
          ref={currentVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover opacity-40"
          key={`current-${currentIndex}`}
        >
          <source src={videos[currentIndex]} type="video/mp4" />
        </video>
      </div>

      {/* Next Video (slides in from right) */}
      <div 
        className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
          isTransitioning ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"
        }`}
      >
        <video
          ref={nextVideoRef}
          muted
          playsInline
          className="w-full h-full object-cover opacity-40"
          key={`next-${nextIndex}`}
        >
          <source src={videos[nextIndex]} type="video/mp4" />
        </video>
      </div>

      {/* Blend overlay during transition */}
      <div 
        className={`absolute inset-0 bg-foreground/30 transition-opacity duration-500 ${
          isTransitioning ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Video indicators */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`h-0.5 w-8 transition-all duration-300 ${
              index === currentIndex 
                ? "bg-white/80" 
                : "bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroVideoCarousel;
