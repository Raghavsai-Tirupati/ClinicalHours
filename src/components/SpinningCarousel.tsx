import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

interface CarouselItem {
  src: string;
  poster: string;
  label: string;
}

const items: CarouselItem[] = [
  {
    src: "/screenshots/dashboard-preview.mp4",
    poster: "/screenshots/dashboard.png",
    label: "Dashboard",
  },
  {
    src: "/screenshots/dashboard-preview2.mp4",
    poster: "/screenshots/dashboard.png",
    label: "Opportunities",
  },
  {
    src: "/screenshots/dashboard-preview3.mp4",
    poster: "/screenshots/dashboard.png",
    label: "Map View",
  },
  {
    src: "/screenshots/dashboard-preview4.mp4",
    poster: "/screenshots/dashboard.png",
    label: "Profile",
  },
];

const AUTO_ROTATE_MS = 5000;

const SpinningCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Auto-rotate
  useEffect(() => {
    if (prefersReducedMotion || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, AUTO_ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, prefersReducedMotion]);

  // Play active video, pause others
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeIndex]);

  const getStyle = (index: number): React.CSSProperties => {
    const diff = index - activeIndex;
    const total = items.length;
    let nd = diff;
    if (diff > total / 2) nd = diff - total;
    if (diff < -total / 2) nd = diff + total;

    const base: React.CSSProperties = {
      position: "absolute",
      left: "50%",
      top: "50%",
      willChange: "transform, opacity",
      transition: prefersReducedMotion
        ? "none"
        : "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    };

    if (nd === 0) {
      return {
        ...base,
        transform: "translate(-50%, -50%) scale(1) rotateY(0deg)",
        zIndex: 30,
        opacity: 1,
      };
    }
    if (nd === 1) {
      return {
        ...base,
        transform: "translate(10%, -50%) scale(0.78) rotateY(-14deg)",
        zIndex: 20,
        opacity: 0.55,
      };
    }
    if (nd === -1) {
      return {
        ...base,
        transform: "translate(-110%, -50%) scale(0.78) rotateY(14deg)",
        zIndex: 20,
        opacity: 0.55,
      };
    }
    return {
      ...base,
      transform: "translate(-50%, -50%) scale(0.5)",
      zIndex: 0,
      opacity: 0,
    };
  };

  return (
    <div
      className="relative w-full"
      style={{ perspective: "1200px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <style>{`
        .sc-video::-webkit-media-controls,
        .sc-video::-webkit-media-controls-enclosure,
        .sc-video::-webkit-media-controls-panel,
        .sc-video::-webkit-media-controls-play-button,
        .sc-video::-webkit-media-controls-start-playback-button,
        .sc-video::-webkit-media-controls-overlay-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `}</style>

      <div className="relative h-[200px] sm:h-[240px] md:h-[260px] flex items-center justify-center">
        {items.map((item, index) => (
          <div
            key={index}
            className="w-[85%] sm:w-[80%] md:w-[90%] max-w-md cursor-pointer"
            style={{
              ...getStyle(index),
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
            onClick={() => setActiveIndex(index)}
          >
            {/* Browser chrome */}
            <div className="rounded-lg overflow-hidden border border-white/10 bg-zinc-900/90 shadow-2xl shadow-black/60">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border-b border-white/5">
                <div className="flex gap-1">
                  <div className="w-[7px] h-[7px] rounded-full bg-red-500/50" />
                  <div className="w-[7px] h-[7px] rounded-full bg-yellow-500/50" />
                  <div className="w-[7px] h-[7px] rounded-full bg-green-500/50" />
                </div>
                <div className="flex-1 mx-2">
                  <div className="max-w-[140px] mx-auto bg-zinc-700/40 rounded px-2 py-0.5 border border-white/5">
                    <span className="text-[8px] text-white/40 block text-center truncate">
                      clinicalhours.org
                    </span>
                  </div>
                </div>
              </div>

              {/* Video */}
              <div className="relative aspect-[16/10] bg-zinc-950 overflow-hidden">
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={item.src}
                  poster={item.poster}
                  muted
                  playsInline
                  loop
                  controls={false}
                  disablePictureInPicture
                  preload={index === 0 ? "auto" : "none"}
                  className="sc-video w-full h-full object-cover object-top pointer-events-none"
                />
                {/* Play icon overlay for inactive */}
                {index !== activeIndex && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white/70 ml-0.5" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "bg-white w-5"
                : "bg-white/25 w-1.5 hover:bg-white/40"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default SpinningCarousel;
