import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroVideo4 from "@/assets/hero-video-4.mp4";

const videos = [heroVideo4, heroVideo3, heroVideo2, heroVideo1];

// Crossfade duration in seconds
const CROSSFADE_DURATION = 0.5;

interface HeroVideoCarouselProps {
  onIndexChange?: (index: number) => void;
}

const HeroVideoCarousel = ({ onIndexChange }: HeroVideoCarouselProps = {}) => {
  // Two persistent slots - we swap which one is on top
  const [slotAVideo, setSlotAVideo] = useState(0);
  const [slotBVideo, setSlotBVideo] = useState(1);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [isFading, setIsFading] = useState(false);
  
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const fadeStartedRef = useRef(false);
  const isMobileDevice = useIsMobile();

  const activeVideoRef = activeSlot === 'A' ? videoRefA : videoRefB;
  const nextVideoRef = activeSlot === 'A' ? videoRefB : videoRefA;

  // Handle when active video is about to end - start crossfade
  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    fadeStartedRef.current = false;

    const handleTimeUpdate = () => {
      if (fadeStartedRef.current || isFading) return;
      const timeRemaining = video.duration - video.currentTime;
      
      if (timeRemaining <= CROSSFADE_DURATION && timeRemaining > 0) {
        fadeStartedRef.current = true;
        
        // Start next video
        const nextVideo = nextVideoRef.current;
        if (nextVideo) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(() => {});
        }
        
        setIsFading(true);
      }
    };

    const handleEnded = () => {
      if (!fadeStartedRef.current && !isFading) {
        fadeStartedRef.current = true;
        const nextVideo = nextVideoRef.current;
        if (nextVideo) {
          nextVideo.currentTime = 0;
          nextVideo.play().catch(() => {});
        }
        setIsFading(true);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [activeSlot, isFading, activeVideoRef, nextVideoRef]);

  // After fade completes, swap slots and prepare next video in the OLD slot
  useEffect(() => {
    if (!isFading) return;
    
    const timer = setTimeout(() => {
      // Swap which slot is active
      const newActiveSlot = activeSlot === 'A' ? 'B' : 'A';
      
      // Figure out what video is now playing (in the new active slot)
      const currentVideoIndex = newActiveSlot === 'A' ? slotAVideo : slotBVideo;
      
      // Load the NEXT video into the OLD slot (which is now underneath)
      const nextVideoIndex = (currentVideoIndex + 1) % videos.length;
      
      if (newActiveSlot === 'B') {
        // Slot A is now the "next" slot - load next video into it
        setSlotAVideo(nextVideoIndex);
      } else {
        // Slot B is now the "next" slot - load next video into it
        setSlotBVideo(nextVideoIndex);
      }
      
      setActiveSlot(newActiveSlot);
      setIsFading(false);
      fadeStartedRef.current = false;
      
      // Notify parent of index change
      onIndexChange?.(currentVideoIndex);
    }, CROSSFADE_DURATION * 1000);
    
    return () => clearTimeout(timer);
  }, [isFading, activeSlot, slotAVideo, slotBVideo, onIndexChange]);

  // Initial play
  useEffect(() => {
    if (videoRefA.current && !isMobileDevice) {
      videoRefA.current.play().catch(() => {});
    }
  }, [isMobileDevice]);

  // Preload video when slot video changes
  useEffect(() => {
    if (videoRefA.current && activeSlot !== 'A') {
      videoRefA.current.load();
      videoRefA.current.currentTime = 0;
    }
  }, [slotAVideo, activeSlot]);

  useEffect(() => {
    if (videoRefB.current && activeSlot !== 'B') {
      videoRefB.current.load();
      videoRefB.current.currentTime = 0;
    }
  }, [slotBVideo, activeSlot]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <style>{`
        video::-webkit-media-controls,
        video::-webkit-media-controls-enclosure,
        video::-webkit-media-controls-panel,
        video::-webkit-media-controls-play-button,
        video::-webkit-media-controls-start-playback-button {
          display: none !important;
        }
        video[controls] {
          display: none;
        }
      `}</style>
      
      {/* Slot A */}
      <div 
        className="absolute inset-0"
        style={{ 
          zIndex: activeSlot === 'A' ? 2 : 1,
          opacity: activeSlot === 'A' ? (isFading ? 0 : 1) : 1,
          transition: `opacity ${CROSSFADE_DURATION}s ease-in-out`,
        }}
      >
        <video
          ref={videoRefA}
          src={videos[slotAVideo]}
          muted
          playsInline
          autoPlay={!isMobileDevice && activeSlot === 'A'}
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload="auto"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>
      
      {/* Slot B */}
      <div 
        className="absolute inset-0"
        style={{ 
          zIndex: activeSlot === 'B' ? 2 : 1,
          opacity: activeSlot === 'B' ? (isFading ? 0 : 1) : 1,
          transition: `opacity ${CROSSFADE_DURATION}s ease-in-out`,
        }}
      >
        <video
          ref={videoRefB}
          src={videos[slotBVideo]}
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload="auto"
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* Dark overlay - always on top */}
      <div className="absolute inset-0 bg-black/60" style={{ zIndex: 10 }} />
    </div>
  );
};

export default HeroVideoCarousel;
