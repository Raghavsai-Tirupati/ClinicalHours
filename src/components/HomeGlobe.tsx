import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { captureGlobe } from '@/lib/GlobeTransitionManager';
import { prefetchOpportunities } from '@/lib/opportunityPrefetch';
import { supabase } from '@/integrations/supabase/client';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';

/**
 * Spinning Mapbox globe clipped to a circle.
 * Designed to sit inline inside the hero section.
 * Click triggers starfield iris → navigate to /map.
 * Shows small opportunity dots (non-interactive).
 */
const HomeGlobe = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const rotateFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283],
      zoom: 1.8,
      pitch: 0,
      interactive: false,
      attributionControl: false,
      projection: 'globe',
      preserveDrawingBuffer: true,
    });

    mapRef.current = m;

    m.on('style.load', () => {
      m.setFog({
        color: 'rgb(10, 15, 30)',
        'high-color': 'rgb(20, 30, 60)',
        'horizon-blend': 0.08,
        'star-intensity': 0.15,
        'space-color': 'rgb(5, 8, 20)',
      });

      // Load opportunity dots
      loadOpportunityDots(m);

      // Start auto-rotation
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        const rotate = () => {
          if (!mapRef.current) return;
          const center = mapRef.current.getCenter();
          center.lng -= 0.015;
          mapRef.current.jumpTo({ center });
          rotateFrameRef.current = requestAnimationFrame(rotate);
        };
        rotateFrameRef.current = requestAnimationFrame(rotate);
      }
    });

    return () => {
      cancelAnimationFrame(rotateFrameRef.current);
      m.remove();
      mapRef.current = null;
    };
  }, []);

  const handleClick = useCallback(() => {
    // Start prefetching opportunities immediately on click
    prefetchOpportunities();

    if (!containerRef.current) {
      navigate('/map');
      return;
    }

    const captured = captureGlobe(containerRef.current);
    if (captured) {
      setTimeout(() => navigate('/map'), 650);
    } else {
      navigate('/map');
    }
  }, [navigate]);

  return (
    <div className="flex flex-col items-center">
      {/* Globe container — circular, responsive */}
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative cursor-pointer group"
        style={{
          width: 'min(38vh, 50vw)',
          height: 'min(38vh, 50vw)',
          minWidth: '200px',
          minHeight: '200px',
          borderRadius: '50%',
          overflow: 'hidden',
        }}
      >
        {/* Glow ring */}
        <div
          className="absolute -inset-4 rounded-full opacity-30 group-hover:opacity-60 transition-opacity duration-700 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.2) 0%, rgba(56,189,248,0.1) 40%, transparent 70%)',
          }}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 z-10 rounded-full bg-black/0 group-hover:bg-black/20 transition-colors duration-500 flex items-center justify-center pointer-events-none">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-100 scale-90">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2.5 flex items-center gap-2 text-white text-sm font-medium">
              Explore Map
            </div>
          </div>
        </div>
      </div>

      {/* Subtle hint text */}
      <p className="mt-4 text-[10px] text-white/30 uppercase tracking-[0.2em]">
        Tap the globe to explore
      </p>
    </div>
  );
};

/** Fetch opportunity coordinates and add as a simple dot layer */
async function loadOpportunityDots(map: mapboxgl.Map) {
  try {
    // Fetch only coordinates — lightweight query
    const { data, error } = await supabase
      .from('opportunities')
      .select('latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error || !data) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: data
        .filter(d => d.latitude && d.longitude)
        .map(d => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [d.longitude!, d.latitude!],
          },
          properties: {},
        })),
    };

    if (!map.getSource('home-dots')) {
      map.addSource('home-dots', { type: 'geojson', data: geojson });

      map.addLayer({
        id: 'home-dots-glow',
        type: 'circle',
        source: 'home-dots',
        paint: {
          'circle-color': '#22d3ee',
          'circle-radius': 3,
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      });

      map.addLayer({
        id: 'home-dots-point',
        type: 'circle',
        source: 'home-dots',
        paint: {
          'circle-color': '#22d3ee',
          'circle-radius': 1.5,
          'circle-opacity': 0.6,
        },
      });
    }
  } catch {
    // Non-critical — globe still works without dots
  }
}

export default HomeGlobe;
