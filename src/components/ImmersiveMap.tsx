import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { Opportunity } from '@/types';
import StarfieldBackground from './StarfieldBackground';
import {
  Map,
  List,
  MapPin,
  RotateCcw,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Bookmark,
  ExternalLink,
  Globe,
  Loader2,
  Home,
} from 'lucide-react';

interface SavedOpportunity {
  opportunity_id: string;
  opportunities: Opportunity;
}

type ViewMode = 'all' | 'saved';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
const RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100, 200];
const DEFAULT_RADIUS_INDEX = 4;

const TYPE_COLORS: Record<string, string> = {
  hospital: '#38bdf8', // sky-400
  clinic: '#34d399',   // emerald-400
  hospice: '#a78bfa',  // violet-400
  emt: '#fbbf24',      // amber-400
};

const TYPE_LABELS: Record<string, string> = {
  hospital: 'Hospital',
  clinic: 'Clinic',
  hospice: 'Hospice',
  emt: 'EMT',
};

const opportunitiesToGeoJSON = (opportunities: Opportunity[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: opportunities
    .filter(opp => opp.latitude && opp.longitude)
    .map(opp => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [opp.longitude!, opp.latitude!],
      },
      properties: {
        id: opp.id,
        name: opp.name,
        type: opp.type,
        location: opp.location,
        acceptance_likelihood: opp.acceptance_likelihood,
        hours_required: opp.hours_required,
        website: opp.website || '',
        email: opp.email || '',
        phone: opp.phone || '',
      },
    })),
});

const ImmersiveMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const isPinModeRef = useRef(false);

  const { user, isReady, isGuest } = useAuth();
  const [mapLoading, setMapLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isPinMode, setIsPinMode] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(RADIUS_OPTIONS[DEFAULT_RADIUS_INDEX]);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [showAll, setShowAll] = useState(true);

  // Info card state
  const [selectedFeature, setSelectedFeature] = useState<Record<string, string> | null>(null);

  const loading = mapLoading || dataLoading;
  const activeCenter = customPin || userLocation;

  useEffect(() => {
    isPinModeRef.current = isPinMode;
  }, [isPinMode]);

    // Fetch ALL opportunities once (client-side distance filtering)
    const fetchOpportunitiesForMap = useCallback(async () => {
      setDataLoading(true);
      try {
        const allData: Opportunity[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('opportunities')
            .select('*')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .range(from, from + batchSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allData.push(...data);
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        setOpportunities(allData);
      } catch (err) {
        logger.error('Error fetching opportunities', err);
        setMapError('Failed to load opportunities.');
      } finally {
        setDataLoading(false);
      }
    }, []);

  useEffect(() => { fetchOpportunitiesForMap(); }, [fetchOpportunitiesForMap]);

  // Fetch saved
  useEffect(() => {
    const fetchSaved = async () => {
      if (!user || !isReady || isGuest) { setSavedOpportunities([]); return; }
      try {
        const { data, error } = await supabase
          .from('saved_opportunities')
          .select('opportunity_id, opportunities (*)')
          .eq('user_id', user.id);
        if (error) throw error;
        const valid: SavedOpportunity[] = [];
        (data || []).forEach((item: { opportunity_id: string; opportunities: Opportunity | Opportunity[] }) => {
          if (item.opportunities && !Array.isArray(item.opportunities)) {
            valid.push({ opportunity_id: item.opportunity_id, opportunities: item.opportunities });
          }
        });
        setSavedOpportunities(valid);
      } catch (err) { logger.error('Error fetching saved', err); }
    };
    fetchSaved();
  }, [user, isReady, isGuest]);

  // Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);

    const filteredOpportunities = useMemo(() => {
      let opps = viewMode === 'saved'
        ? savedOpportunities.map(s => s.opportunities).filter((o): o is Opportunity => Boolean(o?.latitude && o?.longitude))
        : opportunities.filter(o => o.latitude && o.longitude);

    // Client-side distance filtering when we have an active center (skipped when showAll is on)
    if (activeCenter && viewMode === 'all' && !showAll) {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 3958.8; // Earth radius in miles
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        opps = opps.filter(o => haversine(activeCenter.lat, activeCenter.lng, o.latitude!, o.longitude!) <= radiusMiles);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        opps = opps.filter(o => o.name.toLowerCase().includes(q) || o.location.toLowerCase().includes(q));
      }
      return opps;
    }, [viewMode, opportunities, savedOpportunities, searchQuery, activeCenter, radiusMiles, showAll]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!MAPBOX_TOKEN) { setMapError('Mapbox token not configured'); setMapLoading(false); return; }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283],
      zoom: 3.5,
      pitch: 0,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Atmosphere
      map.current.setFog({
        color: 'rgb(10, 15, 30)',
        'high-color': 'rgb(20, 30, 60)',
        'horizon-blend': 0.05,
        'star-intensity': 0.08,
        'space-color': 'rgb(5, 8, 20)',
      });

      // Cluster source
      map.current.addSource('opportunities', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster circles
      map.current.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'opportunities',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#22d3ee', 100, '#a78bfa', 500, '#f472b6'],
          'circle-radius': ['step', ['get', 'point_count'], 18, 100, 26, 500, 36],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
          'circle-opacity': 0.85,
        },
      });

      // Cluster labels
      map.current.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'opportunities',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Individual points
      map.current.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'opportunities',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match', ['get', 'type'],
            'hospital', TYPE_COLORS.hospital,
            'clinic', TYPE_COLORS.clinic,
            'hospice', TYPE_COLORS.hospice,
            'emt', TYPE_COLORS.emt,
            '#94a3b8',
          ],
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.5)',
          'circle-opacity': 0.9,
        },
      });

      // Glow ring around individual points
      map.current.addLayer({
        id: 'unclustered-glow',
        type: 'circle',
        source: 'opportunities',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match', ['get', 'type'],
            'hospital', TYPE_COLORS.hospital,
            'clinic', TYPE_COLORS.clinic,
            'hospice', TYPE_COLORS.hospice,
            'emt', TYPE_COLORS.emt,
            '#94a3b8',
          ],
          'circle-radius': 14,
          'circle-opacity': 0.15,
          'circle-blur': 1,
        },
      });

      // Click cluster → zoom
      map.current.on('click', 'clusters', (e) => {
        if (!map.current) return;
        const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.current.getSource('opportunities') as mapboxgl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !map.current) return;
          const geom = features[0].geometry;
          if (geom.type !== 'Point') return;
          map.current.easeTo({ center: geom.coordinates as [number, number], zoom: zoom ?? 10 });
        });
      });

      // Click point → show info card
      map.current.on('click', 'unclustered-point', (e) => {
        if (!map.current || !e.features?.length) return;
        const props = e.features[0].properties;
        if (props) {
          setSelectedFeature(props as Record<string, string>);
        }
      });

      // Cursors
      map.current.on('mouseenter', 'clusters', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'clusters', () => { if (map.current && !isPinModeRef.current) map.current.getCanvas().style.cursor = ''; });
      map.current.on('mouseenter', 'unclustered-point', () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
      map.current.on('mouseleave', 'unclustered-point', () => { if (map.current && !isPinModeRef.current) map.current.getCanvas().style.cursor = ''; });

      setMapReady(true);
      setMapLoading(false);
    });

    map.current.on('error', () => { setMapError('Error loading map'); setMapLoading(false); });

    // Pin mode click
    map.current.on('click', (e) => {
      if (!isPinModeRef.current || !map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: ['clusters', 'unclustered-point'] });
      if (features.length > 0) return;
      setCustomPin({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      setIsPinMode(false);
    });

    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Update cursor in pin mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isPinMode ? 'crosshair' : '';
  }, [isPinMode]);

  const geojsonData = useMemo(() => opportunitiesToGeoJSON(filteredOpportunities), [filteredOpportunities]);

  // Update source data
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource('opportunities') as mapboxgl.GeoJSONSource;
    if (!source) return;
    source.setData(geojsonData);

    if (filteredOpportunities.length > 0 && !activeCenter && map.current.getZoom() < 3) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredOpportunities.forEach(opp => { if (opp.latitude && opp.longitude) bounds.extend([opp.longitude, opp.latitude]); });
      if (!bounds.isEmpty()) map.current.fitBounds(bounds, { padding: 80, maxZoom: 6 });
    }
  }, [geojsonData, filteredOpportunities, mapReady, activeCenter]);

  // User location marker
  useEffect(() => {
    if (!map.current || !userLocation || !mapReady) return;
    if (userMarkerRef.current) userMarkerRef.current.remove();
    const el = document.createElement('div');
    el.style.cssText = 'width:16px;height:16px;background:#38bdf8;border:2px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(56,189,248,0.25)';
    userMarkerRef.current = new mapboxgl.Marker(el).setLngLat([userLocation.lng, userLocation.lat]).addTo(map.current);
  }, [userLocation, mapReady]);

  // Custom pin marker
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (customPinMarkerRef.current) { customPinMarkerRef.current.remove(); customPinMarkerRef.current = null; }
    if (!customPin) return;
    const el = document.createElement('div');
    el.style.cssText = 'width:24px;height:24px;background:#f472b6;border:2px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(244,114,182,0.3);display:flex;align-items:center;justify-content:center;font-size:12px';
    el.textContent = '📌';
    customPinMarkerRef.current = new mapboxgl.Marker(el).setLngLat([customPin.lng, customPin.lat]).addTo(map.current);
  }, [customPin, mapReady]);

  const handleReset = () => {
    setCustomPin(null);
    setIsPinMode(false);
    if (map.current && userLocation) {
      map.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 7, duration: 1000 });
    }
  };

  const displayCount = filteredOpportunities.length;

  if (mapError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#070c1a]">
        <div className="text-center">
          <Map className="h-12 w-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/50">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070c1a]">
      {/* Starfield behind map */}
      <StarfieldBackground starCount={80} className="z-0" />

      {/* Map glow effect */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-cyan-900/10 blur-3xl" />
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0 z-[2]" />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 bg-[#070c1a]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-white/50 text-sm">Loading opportunities...</p>
          </div>
        </div>
      )}

      {/* Top nav bar — glass overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 h-14 flex items-center px-4 bg-black/30 backdrop-blur-md border-b border-white/5">
        <Link to="/" className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mr-4">
          <Home className="w-4 h-4" />
          <span className="text-sm font-medium hidden sm:inline">ClinicalHours</span>
        </Link>
        <div className="flex items-center gap-1.5 text-white/40">
          <Globe className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Opportunity Map</span>
        </div>
        <div className="ml-auto">
            <span className="text-xs text-white/30 bg-white/5 rounded-full px-3 py-1 border border-white/10">
              {displayCount.toLocaleString()} {!showAll && activeCenter ? `within ${radiusMiles}mi` : 'total'}
            </span>
        </div>
      </div>

      {/* --- DESKTOP LEFT CONTROL PANEL --- */}
      <div className={`
        hidden sm:flex absolute top-20 left-4 z-30 flex-col
        w-72 rounded-2xl overflow-hidden
        bg-black/40 backdrop-blur-xl border border-white/10
        shadow-2xl shadow-black/40
        transition-all duration-300
        ${panelCollapsed ? 'max-h-12' : 'max-h-[calc(100vh-120px)]'}
      `}>
        {/* Panel header */}
        <button
          onClick={() => setPanelCollapsed(!panelCollapsed)}
          className="flex items-center justify-between px-4 py-3 text-sm font-medium text-white/80 hover:text-white transition-colors shrink-0"
        >
          <span>Controls</span>
          {panelCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>

        {!panelCollapsed && (
          <div className="px-4 pb-4 space-y-5 overflow-y-auto">
            {/* View mode toggle */}
            <div className="flex rounded-lg bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                All
              </button>
              <button
                onClick={() => { if (user && !isGuest) setViewMode('saved'); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'saved'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                    : 'text-white/40 hover:text-white/60'
                } ${!user || isGuest ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Saved
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search hospitals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

              {/* Show All toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-white/50">Show All Hospitals</label>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${showAll ? 'bg-cyan-500' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${showAll ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Radius slider */}
              {activeCenter && !showAll && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-white/50">Radius</label>
                  <span className="text-xs text-cyan-400">{radiusMiles} mi</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={RADIUS_OPTIONS.length - 1}
                  step="1"
                  value={RADIUS_OPTIONS.indexOf(radiusMiles)}
                  onChange={(e) => setRadiusMiles(RADIUS_OPTIONS[Number(e.target.value)])}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-cyan-400/30"
                />
                <div className="flex justify-between text-[10px] text-white/20">
                  <span>1mi</span>
                  <span>200mi</span>
                </div>
              </div>
            )}

            {/* Pin controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsPinMode(!isPinMode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-all ${
                  isPinMode
                    ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                {isPinMode ? 'Click map...' : 'Drop Pin'}
              </button>
              {customPin && (
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-white/30">Legend</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[key] }} />
                    <span className="text-[11px] text-white/40">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- MOBILE BOTTOM SHEET --- */}
      <div className="sm:hidden absolute bottom-0 left-0 right-0 z-30">
        {/* Toggle handle */}
        <div className="flex justify-center py-2">
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 text-white/70 text-xs font-medium"
          >
            <Map className="w-3.5 h-3.5 text-cyan-400" />
            {displayCount.toLocaleString()} opportunities
            {mobileSheetOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {mobileSheetOpen && (
          <div className="bg-black/60 backdrop-blur-xl border-t border-white/10 rounded-t-2xl p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* View toggle */}
            <div className="flex rounded-lg bg-white/5 p-0.5">
              <button
                onClick={() => setViewMode('all')}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${viewMode === 'all' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'}`}
              >
                All
              </button>
              <button
                onClick={() => { if (user && !isGuest) setViewMode('saved'); }}
                className={`flex-1 py-2 text-xs font-medium rounded-md transition-all ${viewMode === 'saved' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40'} ${!user || isGuest ? 'opacity-40' : ''}`}
              >
                Saved
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-cyan-500/40"
              />
            </div>

              {/* Show All toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-white/50">Show All Hospitals</span>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${showAll ? 'bg-cyan-500' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${showAll ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Radius */}
              {activeCenter && !showAll && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Radius</span>
                  <span className="text-cyan-400">{radiusMiles} mi</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={RADIUS_OPTIONS.length - 1}
                  step="1"
                  value={RADIUS_OPTIONS.indexOf(radiusMiles)}
                  onChange={(e) => setRadiusMiles(RADIUS_OPTIONS[Number(e.target.value)])}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
                />
              </div>
            )}

            {/* Pin & Reset */}
            <div className="flex gap-2">
              <button
                onClick={() => { setIsPinMode(!isPinMode); setMobileSheetOpen(false); }}
                className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${isPinMode ? 'bg-pink-500/20 border-pink-500/40 text-pink-300' : 'bg-white/5 border-white/10 text-white/50'}`}
              >
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                {isPinMode ? 'Tap map...' : 'Drop Pin'}
              </button>
              {customPin && (
                <button onClick={handleReset} className="px-4 py-2.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white/50">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
                  <span className="text-[10px] text-white/40">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- FLOATING INFO CARD --- */}
      {selectedFeature && (
        <div className="absolute bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-40 w-[90vw] max-w-sm">
          <div className="bg-black/60 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl shadow-black/50 relative">
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-white font-semibold text-sm pr-6 mb-2 leading-snug">
              {selectedFeature.name || 'Unknown'}
            </h3>

            <div className="space-y-1.5 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[selectedFeature.type] || '#94a3b8' }}
                />
                <span className="text-xs text-white/50 capitalize">
                  {selectedFeature.type === 'emt' ? 'EMT' : selectedFeature.type || 'N/A'}
                </span>
              </div>
              <p className="text-xs text-white/40">
                {selectedFeature.location || 'N/A'}
              </p>
            </div>

            <div className="flex gap-2">
              {selectedFeature.id && (
                <Link
                  to={`/opportunities/${selectedFeature.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Details
                </Link>
              )}
              {selectedFeature.website && (
                <a
                  href={selectedFeature.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 text-white/50 border border-white/10 hover:text-white/70 transition-colors"
                >
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No saved message */}
      {viewMode === 'saved' && savedOpportunities.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-md rounded-2xl p-6 text-center border border-white/10">
            <Bookmark className="h-8 w-8 mx-auto mb-2 text-white/20" />
            <p className="text-white/40 text-sm">
              {user ? "No saved opportunities yet" : "Log in to see saved"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImmersiveMap;
