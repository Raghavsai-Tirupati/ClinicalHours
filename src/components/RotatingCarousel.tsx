import { useState, useEffect, useRef, useCallback } from "react";

interface CarouselItem {
  poster: string;
  video: string;
  label: string;
}

const items: CarouselItem[] = [
  { poster: "/screenshots/map.png", video: "/screenshots/dashboard-preview.mp4", label: "Dashboard" },
  { poster: "/screenshots/opportunities.png", video: "/screenshots/dashboard-preview2.mp4", label: "Opportunities" },
  { poster: "/screenshots/profile.png", video: "/screenshots/dashboard-preview3.mp4", label: "Profile" },
  { poster: "/screenshots/map.png", video: "/screenshots/dashboard-preview4.mp4", label: "Tracking" },
];

const ROTATION_INTERVAL = 5000;

function BrowserFrame({
  item,
  isActive,
}: {
  item: CarouselItem;
  isActive: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isActive]);

  return (
    <div className="browser-frame">
      <div className="browser-chrome">
        <span className="browser-dot red" />
        <span className="browser-dot yellow" />
        <span className="browser-dot green" />
        <span className="browser-url">{item.label}</span>
      </div>
      <div className="browser-viewport">
        <video
          ref={videoRef}
          src={item.video}
          poster={item.poster}
          muted
          autoPlay={isActive}
          loop
          playsInline
          className="browser-video"
        />
      </div>
    </div>
  );
}

const RotatingCarousel = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, ROTATION_INTERVAL);
    return () => clearInterval(id);
  }, [paused, reducedMotion]);

  const goTo = useCallback((i: number) => setActiveIndex(i), []);

  return (
    <div
      className="carousel-root"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="carousel-track">
          {items.map((item, i) => {
            const n = items.length;
            let offset = i - activeIndex;
            // Normalize to range [-1, n-2] so we get a continuous ring
            if (offset < 0) offset += n;
            // offset is now 0 = active, 1 = right, n-1 = left, 2 = back (hidden)

            const isActive = offset === 0;
            const isLeft = offset === n - 1;
            const isRight = offset === 1;
            const isHidden = !isActive && !isLeft && !isRight;

            let translateX = "0%";
            let scale = 1;
            let zIndex = 10;
            let opacity = 1;
            let brightness = "none";

            if (isActive) {
              translateX = "0%";
              scale = 1;
              zIndex = 10;
              opacity = 1;
              brightness = "none";
            } else if (isLeft) {
              translateX = "-72%";
              scale = 0.75;
              zIndex = 5;
              opacity = 0.5;
              brightness = "brightness(0.6)";
            } else if (isRight) {
              translateX = "72%";
              scale = 0.75;
              zIndex = 5;
              opacity = 0.5;
              brightness = "brightness(0.6)";
            } else {
              // Hidden behind the active card
              translateX = "0%";
              scale = 0.5;
              zIndex = 1;
              opacity = 0;
              brightness = "brightness(0.3)";
            }

            return (
              <div
                key={i}
                className={`carousel-slide ${isActive ? "carousel-slide--active" : ""}`}
                style={{
                  transform: `translateX(${translateX}) scale(${scale})`,
                  zIndex,
                  opacity,
                  filter: brightness,
                  pointerEvents: isHidden ? "none" : "auto",
                  transition: reducedMotion
                    ? "none"
                    : "transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease, filter 0.5s ease",
                }}
                onClick={() => !isActive && goTo(i)}
              >
                <BrowserFrame item={item} isActive={isActive} />
              </div>
            );
          })}
      </div>

      {/* Dots */}
      <div className="carousel-dots">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`carousel-dot ${i === activeIndex ? "carousel-dot--active" : ""}`}
            aria-label={`Show preview ${i + 1}`}
          />
        ))}
      </div>

      <style>{`
        .carousel-root {
          position: relative;
          width: 100%;
          padding-bottom: 12px;
        }

          .carousel-track {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 300px;
            overflow: visible;
          }

          @media (max-width: 640px) {
            .carousel-track {
              height: 230px;
            }
          }

          .carousel-slide {
            position: absolute;
            width: 340px;
          cursor: pointer;
          will-change: transform, opacity;
        }

          @media (max-width: 640px) {
            .carousel-slide {
              width: 280px;
            }
          }

        .carousel-slide--active {
          cursor: default;
        }

        /* ── Browser frame ─────────────────── */
        .browser-frame {
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.45);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }

        .browser-chrome {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 10px;
          background: rgba(255,255,255,0.06);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .browser-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .browser-dot.red { background: #ff5f57; }
        .browser-dot.yellow { background: #febc2e; }
        .browser-dot.green { background: #28c840; }

        .browser-url {
          margin-left: auto;
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          font-family: inherit;
        }

        .browser-viewport {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          overflow: hidden;
        }

        .browser-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* ── Dots ──────────────────────────── */
        .carousel-dots {
          display: flex;
          justify-content: center;
          gap: 6px;
          margin-top: 14px;
        }

        .carousel-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          border: none;
          padding: 0;
          background: rgba(255,255,255,0.25);
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }

        .carousel-dot--active {
          background: rgba(255,255,255,0.85);
          transform: scale(1.3);
        }

        @media (prefers-reduced-motion: reduce) {
          .carousel-slide {
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default RotatingCarousel;
