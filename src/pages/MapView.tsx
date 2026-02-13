import { useState, useEffect, useRef } from 'react';
import ImmersiveMap from '@/components/ImmersiveMap';
import {
  isActive as isTransitionActive,
  morphToTarget,
  cleanup as cleanupTransition,
} from '@/lib/GlobeTransitionManager';

const MapView = () => {
  const hasTransition = !!(window as any).__globeTransition;
  const [mapVisible, setMapVisible] = useState(!hasTransition);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphedRef = useRef(false);

  useEffect(() => {
    if (!hasTransition || !isTransitionActive()) {
      setMapVisible(true);
      return;
    }

    // Safety timeout: force cleanup after 5s
    safetyTimerRef.current = setTimeout(() => {
      cleanupTransition();
      setMapVisible(true);
    }, 5000);

    // Morph immediately to viewport center — don't wait for map load.
    // Target: same size as source globe, centered in viewport
    if (!morphedRef.current) {
      morphedRef.current = true;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Morph to a circle slightly larger than source, centered in viewport
      const targetSize = Math.min(vw, vh) * 0.5;
      const targetRect = {
        x: (vw - targetSize) / 2,
        y: (vh - targetSize) / 2,
        width: targetSize,
        height: targetSize,
      };

      morphToTarget(
        targetRect,
        () => {
          setMapVisible(true);
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        },
        () => {
          // cleanup handled inside morphToTarget
        }
      );
    }

    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, [hasTransition]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div
        style={{
          opacity: mapVisible ? 1 : 0,
          transition: mapVisible ? 'opacity 300ms ease-out' : 'none',
          position: 'absolute',
          inset: 0,
        }}
      >
        <ImmersiveMap />
      </div>
    </div>
  );
};

export default MapView;
