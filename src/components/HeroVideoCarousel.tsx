import { useState, useEffect, useRef, useCallback } from "react";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroVideo4 from "@/assets/hero-video-4.mp4";

const videos = [heroVideo1, heroVideo2, heroVideo3, heroVideo4];

const HeroVideoCarousel = () => {
  const [activeVideo, setActiveVideo] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"none" | "left">("none");
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const handleVideoEnd = useCallback(() => {
    // Reset next video to beginning BEFORE transition starts
    const nextIndex = (activeVideo + 1) % videos.length;
    const nextVideo = videoRefs.current[nextIndex];
    if (nextVideo) {
      nextVideo.currentTime = 0;
      nextVideo.pause();
    }
    
    setSlideDirection("left");
    
    // After slide animation, switch to next video
    setTimeout(() => {
      setActiveVideo(nextIndex);
      setSlideDirection("none");
    }, 800);
  }, [activeVideo]);

  // Play active video when it changes
  useEffect(() => {
    const video = videoRefs.current[activeVideo];
    if (video) {
      video.currentTime = 0;
      video.play().catch(() => {});
    }
  }, [activeVideo]);

  // Set up video end listener
  useEffect(() => {
    const video = videoRefs.current[activeVideo];
    if (!video) return;

    video.addEventListener("ended", handleVideoEnd);
    return () => video.removeEventListener("ended", handleVideoEnd);
  }, [activeVideo, handleVideoEnd]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {videos.map((src, index) => {
        const isActive = index === activeVideo;
        const isNext = index === (activeVideo + 1) % videos.length;
        
        let transform = "translate-x-full"; // Off screen right by default
        let opacity = "opacity-0";
        
        if (isActive) {
          if (slideDirection === "left") {
            transform = "-translate-x-full";
            opacity = "opacity-0";
          } else {
            transform = "translate-x-0";
            opacity = "opacity-100";
          }
        } else if (isNext && slideDirection === "left") {
          transform = "translate-x-0";
          opacity = "opacity-100";
        }

        return (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-700 ease-out ${transform} ${opacity}`}
          >
            <video
              ref={(el) => (videoRefs.current[index] = el)}
              muted
              playsInline
              autoPlay={index === 0}
              className="w-full h-full object-cover"
            >
              <source src={src} type="video/mp4" />
            </video>
          </div>
        );
      })}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Extra blend during transition */}
      <div 
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
          slideDirection === "left" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Video indicators */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`h-0.5 w-8 transition-all duration-300 ${
              index === activeVideo 
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
