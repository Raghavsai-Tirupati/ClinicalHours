import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, ChevronDown } from 'lucide-react';
import StarfieldBackground from './StarfieldBackground';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

const HomeMapPreview = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283],
      zoom: 3.2,
      pitch: 20,
      interactive: false, // preview only — no drag/zoom
      attributionControl: false,
      projection: 'globe',
    });

    map.current.on('style.load', () => {
      if (!map.current) return;
      // Add atmospheric fog for globe glow
      map.current.setFog({
        color: 'rgb(10, 15, 30)',
        'high-color': 'rgb(20, 30, 60)',
        'horizon-blend': 0.08,
        'star-intensity': 0.12,
        'space-color': 'rgb(5, 8, 20)',
      });
      setMapReady(true);
    });

    // Slow auto-rotate
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReduced) {
      let rotateFrame: number;
      const rotate = () => {
        if (!map.current) return;
        const center = map.current.getCenter();
        center.lng -= 0.01;
        map.current.setCenter(center);
        rotateFrame = requestAnimationFrame(rotate);
      };
      map.current.on('style.load', () => {
        rotateFrame = requestAnimationFrame(rotate);
      });
      return () => {
        cancelAnimationFrame(rotateFrame);
        map.current?.remove();
        map.current = null;
      };
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const handleClick = () => {
    navigate('/map');
  };

  return (
    <section
      className="relative overflow-hidden cursor-pointer group"
      style={{ minHeight: '65vh' }}
      onClick={handleClick}
    >
      {/* Deep space background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050a18] via-[#0a1028] to-[#060d1f]" />
      <StarfieldBackground starCount={150} />

      {/* Map container with glow */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full py-12 sm:py-16 px-4">
        {/* Title overlay */}
        <div className="text-center mb-8 sm:mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-400/70 mb-2">
            <MapPin className="w-3.5 h-3.5" />
            <span>Interactive Map</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-white tracking-wide font-heading">
            Explore opportunities near you
          </h2>
          <p className="text-white/40 text-sm sm:text-base max-w-md mx-auto">
            Tap the map to open the live opportunity map
          </p>
        </div>

        {/* Map preview with glow border */}
        <div className="relative w-full max-w-5xl mx-auto">
          {/* Outer glow */}
          <div className="absolute -inset-1 sm:-inset-2 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-purple-500/20 blur-xl opacity-60 group-hover:opacity-90 transition-opacity duration-700" />

          {/* Map frame */}
          <div className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-cyan-900/20">
            {/* Loading state */}
            {!mapReady && (
              <div className="absolute inset-0 z-20 bg-[#0a1028] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>
            )}

            <div
              ref={mapContainer}
              className="w-full aspect-[16/9] sm:aspect-[2.2/1]"
              style={{ minHeight: '280px' }}
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 z-10 bg-black/0 group-hover:bg-black/20 transition-colors duration-500 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-100 scale-90">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-3 flex items-center gap-2 text-white text-sm font-medium">
                  <MapPin className="w-4 h-4" />
                  Open Full Map
                </div>
              </div>
            </div>

            {/* Subtle vignette */}
            <div className="absolute inset-0 z-[5] pointer-events-none rounded-xl sm:rounded-2xl"
              style={{
                boxShadow: 'inset 0 0 80px rgba(0,0,0,0.4)',
              }}
            />
          </div>
        </div>

        {/* Animated arrow hint */}
        <div className="mt-8 animate-bounce text-white/30">
          <ChevronDown className="w-5 h-5" />
        </div>
      </div>
    </section>
  );
};

export default HomeMapPreview;
