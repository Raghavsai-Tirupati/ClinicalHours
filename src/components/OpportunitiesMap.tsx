import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  hours_required: string;
  acceptance_likelihood: string;
  distance?: number;
}

interface OpportunitiesMapProps {
  opportunities: Opportunity[];
  userLocation: { lat: number; lng: number } | null;
}

const OpportunitiesMap = ({ opportunities, userLocation }: OpportunitiesMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || "";

    const initialCenter: [number, number] = userLocation 
      ? [userLocation.lng, userLocation.lat]
      : [-98.5795, 39.8283]; // Center of US

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: initialCenter,
      zoom: userLocation ? 10 : 4,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl(),
      "top-right"
    );

    // Add user location marker if available
    if (userLocation) {
      new mapboxgl.Marker({ color: "hsl(195, 100%, 42%)" })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML("<strong>Your Location</strong>")
        )
        .addTo(map.current);
    }

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [userLocation]);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for opportunities with valid coordinates
    const validOpportunities = opportunities.filter(
      opp => opp.latitude && opp.longitude
    );

    validOpportunities.forEach((opportunity) => {
      if (!opportunity.latitude || !opportunity.longitude || !map.current) return;

      // Create marker color based on acceptance likelihood
      let markerColor = "hsl(215, 16%, 47%)"; // default muted
      if (opportunity.acceptance_likelihood.toLowerCase() === "high") {
        markerColor = "hsl(142, 76%, 36%)"; // success
      } else if (opportunity.acceptance_likelihood.toLowerCase() === "medium") {
        markerColor = "hsl(195, 100%, 34%)"; // primary
      } else if (opportunity.acceptance_likelihood.toLowerCase() === "low") {
        markerColor = "hsl(0, 84%, 60%)"; // destructive
      }

      // Create popup content
      const popupContent = `
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 8px; color: hsl(215, 25%, 27%);">${opportunity.name}</h3>
          <p style="color: hsl(215, 16%, 47%); margin-bottom: 4px; font-size: 14px;">
            <strong>Type:</strong> ${opportunity.type}
          </p>
          <p style="color: hsl(215, 16%, 47%); margin-bottom: 4px; font-size: 14px;">
            <strong>Location:</strong> ${opportunity.location}
          </p>
          <p style="color: hsl(215, 16%, 47%); margin-bottom: 4px; font-size: 14px;">
            <strong>Hours:</strong> ${opportunity.hours_required}
          </p>
          <p style="color: hsl(215, 16%, 47%); margin-bottom: 4px; font-size: 14px;">
            <strong>Acceptance:</strong> ${opportunity.acceptance_likelihood}
          </p>
          ${opportunity.distance !== undefined ? `
            <p style="color: hsl(195, 100%, 34%); font-weight: 500; font-size: 14px;">
              <strong>Distance:</strong> ${opportunity.distance.toFixed(1)} miles
            </p>
          ` : ''}
        </div>
      `;

      const marker = new mapboxgl.Marker({ color: markerColor })
        .setLngLat([opportunity.longitude, opportunity.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(popupContent))
        .addTo(map.current);

      markers.current.push(marker);
    });

    // Fit bounds to show all markers
    if (validOpportunities.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      
      validOpportunities.forEach((opp) => {
        if (opp.latitude && opp.longitude) {
          bounds.extend([opp.longitude, opp.latitude]);
        }
      });

      // Include user location in bounds if available
      if (userLocation) {
        bounds.extend([userLocation.lng, userLocation.lat]);
      }

      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 14,
      });
    }
  }, [opportunities, userLocation]);

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default OpportunitiesMap;
