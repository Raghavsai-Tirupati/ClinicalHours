import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Map, List, MapPin, RotateCcw } from 'lucide-react';

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  acceptance_likelihood: string;
  hours_required: string;
  website?: string;
  email?: string;
  phone?: string;
}

interface SavedOpportunity {
  opportunity_id: string;
  opportunities: Opportunity;
}

type ViewMode = 'all' | 'saved';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
const DEFAULT_RADIUS_MILES = 100;

// Calculate distance between two points in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const OpportunityMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isPinMode, setIsPinMode] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(DEFAULT_RADIUS_MILES);

  // The active center is either custom pin or user location
  const activeCenter = customPin || userLocation;

  // Fetch all opportunities
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const { data, error } = await supabase
          .from('opportunities')
          .select('*')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (error) throw error;
        setOpportunities(data || []);
      } catch (err: any) {
        console.error('Error fetching opportunities:', err);
      }
    };

    fetchOpportunities();
  }, []);

  // Fetch saved opportunities if user is logged in
  useEffect(() => {
    const fetchSavedOpportunities = async () => {
      if (!user) {
        setSavedOpportunities([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('saved_opportunities')
          .select(`
            opportunity_id,
            opportunities (*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        
        const validData: SavedOpportunity[] = [];
        (data || []).forEach((item: any) => {
          if (item.opportunities && !Array.isArray(item.opportunities)) {
            validData.push({
              opportunity_id: item.opportunity_id,
              opportunities: item.opportunities as Opportunity,
            });
          }
        });
        setSavedOpportunities(validData);
      } catch (err: any) {
        console.error('Error fetching saved opportunities:', err);
      }
    };

    fetchSavedOpportunities();
  }, [user]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log('Map: User location detected:', loc);
          setUserLocation(loc);
        },
        (error) => {
          console.error('Map: Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
        }
      );
    }
  }, []);

  // Filter opportunities within radius (or show all if no center)
  const getFilteredOpportunities = useCallback(() => {
    const baseOpportunities = viewMode === 'all' 
      ? opportunities 
      : savedOpportunities.map(s => s.opportunities).filter(Boolean);

    // If no active center, show all opportunities
    if (!activeCenter) {
      const filtered = baseOpportunities.filter(opp => opp.latitude && opp.longitude);
      console.log('Map: No active center, showing all:', filtered.length);
      return filtered;
    }

    const filtered = baseOpportunities.filter(opp => {
      if (!opp.latitude || !opp.longitude) return false;
      const distance = calculateDistance(
        activeCenter.lat,
        activeCenter.lng,
        opp.latitude,
        opp.longitude
      );
      return distance <= radiusMiles;
    });
    
    console.log('Map: Filtered by radius', radiusMiles, 'miles from', activeCenter, ':', filtered.length, 'results');
    return filtered;
  }, [activeCenter, opportunities, savedOpportunities, viewMode, radiusMiles]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured');
      setLoading(false);
      return;
    }

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('load', () => {
        setLoading(false);
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Error loading map');
        setLoading(false);
      });

      // Handle map click for custom pin
      map.current.on('click', (e) => {
        if (!isPinMode) return;
        
        setCustomPin({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
        });
        setIsPinMode(false);
      });
    } catch (err: any) {
      console.error('Map initialization error:', err);
      setMapError('Failed to initialize map');
      setLoading(false);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update cursor when in pin mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isPinMode ? 'crosshair' : '';
  }, [isPinMode]);

  // Update markers when data or mode changes
  useEffect(() => {
    if (!map.current || loading) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Get filtered opportunities within radius
    const displayOpportunities = getFilteredOpportunities();

    // Add markers for each opportunity
    displayOpportunities.forEach((opp) => {
      if (!opp.latitude || !opp.longitude) return;

      const el = document.createElement('div');
      el.className = 'opportunity-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s;
      `;

      const colors: Record<string, string> = {
        hospital: '#3B82F6',
        clinic: '#10B981',
        hospice: '#8B5CF6',
        emt: '#F59E0B',
        volunteer: '#EC4899',
      };
      el.style.backgroundColor = colors[opp.type] || '#6B7280';
      
      const icons: Record<string, string> = {
        hospital: '🏥',
        clinic: '🏪',
        hospice: '🏠',
        emt: '🚑',
        volunteer: '❤️',
      };
      el.textContent = icons[opp.type] || '📍';

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px',
      }).setHTML(`
        <div style="padding: 8px; font-family: system-ui, sans-serif;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">${opp.name}</h3>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280; text-transform: capitalize;">
            <strong>Type:</strong> ${opp.type}
          </p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">
            <strong>Location:</strong> ${opp.location}
          </p>
          <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">
            <strong>Hours:</strong> ${opp.hours_required}
          </p>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280; text-transform: capitalize;">
            <strong>Acceptance:</strong> ${opp.acceptance_likelihood}
          </p>
          ${opp.website ? `<a href="${opp.website}" target="_blank" rel="noopener" style="font-size: 12px; color: #3b82f6; text-decoration: underline;">Visit Website</a>` : ''}
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([opp.longitude, opp.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Fit bounds to markers if there are any
    if (displayOpportunities.length > 0) {
      if (activeCenter) {
        map.current.flyTo({
          center: [activeCenter.lng, activeCenter.lat],
          zoom: 7,
          duration: 1000,
        });
      } else {
        // Fit to all markers if no center
        const bounds = new mapboxgl.LngLatBounds();
        displayOpportunities.forEach((opp) => {
          if (opp.latitude && opp.longitude) {
            bounds.extend([opp.longitude, opp.latitude]);
          }
        });
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 6 });
      }
    }
  }, [opportunities, savedOpportunities, viewMode, loading, activeCenter, getFilteredOpportunities]);

  // Add user location marker
  useEffect(() => {
    if (!map.current || !userLocation || loading) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const el = document.createElement('div');
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
    `;

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="padding: 8px; font-family: system-ui, sans-serif;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">📍 Your Location</h3>
      </div>
    `);

    userMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(popup)
      .addTo(map.current);
  }, [userLocation, loading]);

  // Add custom pin marker
  useEffect(() => {
    if (!map.current || loading) return;

    if (customPinMarkerRef.current) {
      customPinMarkerRef.current.remove();
      customPinMarkerRef.current = null;
    }

    if (!customPin) return;

    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px;
      height: 32px;
      background: #EF4444;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.3), 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    `;
    el.textContent = '📌';

    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div style="padding: 8px; font-family: system-ui, sans-serif;">
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1f2937;">📌 Custom Location</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Showing opportunities within ${radiusMiles} miles</p>
      </div>
    `);

    customPinMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat([customPin.lng, customPin.lat])
      .setPopup(popup)
      .addTo(map.current);
  }, [customPin, loading]);

  const handleResetToMyLocation = () => {
    setCustomPin(null);
    setIsPinMode(false);
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 7,
        duration: 1000,
      });
    }
  };

  const displayCount = getFilteredOpportunities().length;

  if (mapError) {
    return (
      <div className="w-full h-[600px] rounded-xl bg-card border border-border flex items-center justify-center">
        <div className="text-center">
          <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden border border-border">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Mode toggle */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2">
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
          className="bg-background/90 backdrop-blur-sm"
        >
          <Map className="h-4 w-4 mr-2" />
          All Opportunities
        </Button>
        <Button
          variant={viewMode === 'saved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('saved')}
          disabled={!user}
          className="bg-background/90 backdrop-blur-sm"
        >
          <List className="h-4 w-4 mr-2" />
          My Saved
        </Button>
      </div>

      {/* Pin controls */}
      <div className="absolute top-16 left-4 z-10 flex flex-wrap gap-2">
        <Button
          variant={isPinMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsPinMode(!isPinMode)}
          className="bg-background/90 backdrop-blur-sm"
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isPinMode ? 'Click map to place pin...' : 'Drop Pin'}
        </Button>
        {customPin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToMyLocation}
            className="bg-background/90 backdrop-blur-sm"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to My Location
          </Button>
        )}
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 right-16 z-10">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-foreground">
          {displayCount} {activeCenter ? `within ${radiusMiles} mi` : 'total'}
        </Badge>
      </div>

      {/* Radius control - only show when we have a center */}
      {activeCenter && (
        <div className="absolute top-28 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border">
          <label className="text-xs font-medium text-foreground mb-2 block">
            Radius: {radiusMiles} miles
          </label>
          <input
            type="range"
            min="25"
            max="500"
            step="25"
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            className="w-32 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      {/* Location prompt - only show briefly if no location */}
      {!activeCenter && !loading && opportunities.length > 0 && (
        <div className="absolute top-28 left-4 z-10 bg-primary/90 backdrop-blur-sm rounded-lg p-3 border border-primary max-w-xs">
          <p className="text-sm text-primary-foreground font-medium">
            📍 Showing all {displayCount} opportunities. Enable location or drop a pin to filter by distance.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border">
        <p className="text-xs font-medium text-foreground mb-2">Legend</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#3B82F6] flex items-center justify-center text-[10px]">🏥</span>
            <span className="text-muted-foreground">Hospital</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#10B981] flex items-center justify-center text-[10px]">🏪</span>
            <span className="text-muted-foreground">Clinic</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#8B5CF6] flex items-center justify-center text-[10px]">🏠</span>
            <span className="text-muted-foreground">Hospice</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#F59E0B] flex items-center justify-center text-[10px]">🚑</span>
            <span className="text-muted-foreground">EMT</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#EC4899] flex items-center justify-center text-[10px]">❤️</span>
            <span className="text-muted-foreground">Volunteer</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#3B82F6] border-2 border-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)]" style={{ width: '12px', height: '12px' }}></span>
            <span className="text-muted-foreground">You</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#EF4444] border-2 border-white flex items-center justify-center text-[10px]">📌</span>
            <span className="text-muted-foreground">Custom Pin</span>
          </div>
        </div>
      </div>

      {/* No saved message */}
      {viewMode === 'saved' && savedOpportunities.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-background/90 backdrop-blur-sm rounded-lg p-6 text-center border border-border">
            <List className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              {user ? "You haven't saved any opportunities yet" : "Log in to see your saved opportunities"}
            </p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default OpportunityMap;