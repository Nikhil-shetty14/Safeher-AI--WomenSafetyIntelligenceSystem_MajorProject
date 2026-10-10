import axios from 'axios';
import * as Location from 'expo-location';

// Secure Mapbox Access Token resolution with fallback support
export const MAPBOX_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  '';

export type MapboxStyleType =
  | 'dark'
  | 'navigation'
  | 'streets'
  | 'outdoors'
  | 'carto_dark'
  | 'osm';

export interface MapboxTileConfig {
  id: MapboxStyleType;
  label: string;
  icon: string;
  urlTemplate: string;
  attribution: string;
  tileSize: number;
}

// Mapbox & High-Definition Vector/Raster basemap configurations
export const MAPBOX_STYLES: Record<MapboxStyleType, MapboxTileConfig> = {
  dark: {
    id: 'dark',
    label: 'Mapbox Dark',
    icon: 'moon',
    urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`,
    attribution: '© Mapbox © OpenStreetMap',
    tileSize: 256,
  },
  navigation: {
    id: 'navigation',
    label: 'Safety Navigation',
    icon: 'navigate',
    urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`,
    attribution: '© Mapbox © OpenStreetMap',
    tileSize: 256,
  },
  streets: {
    id: 'streets',
    label: 'Mapbox Streets',
    icon: 'map',
    urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`,
    attribution: '© Mapbox © OpenStreetMap',
    tileSize: 256,
  },
  carto_dark: {
    id: 'carto_dark',
    label: 'CARTO Cyber Dark',
    icon: 'shield',
    urlTemplate: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png`,
    attribution: '© CARTO © OpenStreetMap',
    tileSize: 256,
  },
  outdoors: {
    id: 'outdoors',
    label: 'Mapbox Outdoors',
    icon: 'leaf',
    urlTemplate: `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`,
    attribution: '© Mapbox © OpenStreetMap',
    tileSize: 256,
  },
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    icon: 'globe',
    urlTemplate: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`,
    attribution: '© OpenStreetMap contributors',
    tileSize: 256,
  },
};

export interface RouteGeometryPoint {
  latitude: number;
  longitude: number;
}

export interface MapboxRouteResult {
  coordinates: RouteGeometryPoint[];
  distanceMeters: number;
  durationMinutes: number;
  summary: string;
  steps: {
    instruction: string;
    distance: number;
    duration: number;
  }[];
}

export interface GeocodeFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{ id: string; text: string }>;
}

/**
 * Reverse geocodes coordinates to human-readable street / neighborhood address
 * Tries native device reverse-geocoder first (fast, 100% free, no 401s), then Mapbox.
 */
export async function mapboxReverseGeocode(
  lat: number,
  lng: number
): Promise<{ formattedAddress: string; placeName: string; neighborhood: string; city: string }> {
  // 1. Try Native Android / iOS Geocoder first
  try {
    const nativeResults = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (nativeResults && nativeResults.length > 0) {
      const item = nativeResults[0];
      const placeParts = [item.name, item.street].filter(Boolean);
      const placeName = placeParts.join(', ') || item.subregion || item.city || 'Current Location';
      const neighborhood = item.district || item.subregion || item.street || '';
      const city = item.city || item.region || '';
      const formattedAddress = [item.name, item.street, item.subregion, item.city, item.region]
        .filter(Boolean)
        .join(', ');

      return {
        formattedAddress: formattedAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        placeName,
        neighborhood,
        city,
      };
    }
  } catch (nativeErr) {
    // Silently fall through to Mapbox API
  }

  // 2. Try Mapbox Geocoding API if native geocoding did not return
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,poi,neighborhood,locality,place&limit=1&access_token=${MAPBOX_ACCESS_TOKEN}`;
    const response = await axios.get(url, { timeout: 6000 });
    const features = response.data?.features;

    if (features && features.length > 0) {
      const feat = features[0];
      const placeName = feat.place_name || '';
      const parts = placeName.split(',');
      const neighborhood = parts[0]?.trim() || feat.text || '';
      const city = parts[1]?.trim() || '';
      return {
        formattedAddress: placeName,
        placeName: feat.text || parts[0]?.trim() || '',
        neighborhood,
        city,
      };
    }
  } catch (error: any) {
    // Suppress noisy console log if token is restricted
  }

  return {
    formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    placeName: 'Live Telemetry Location',
    neighborhood: 'Monitored Sector',
    city: '',
  };
}

/**
 * Forward geocodes a search string to find destination coordinates
 * Combines Native Geocoder and Mapbox Places Search
 */
export async function mapboxForwardGeocode(
  query: string,
  proximityLat?: number,
  proximityLng?: number
): Promise<GeocodeFeature[]> {
  if (!query || query.trim().length === 0) return [];

  const results: GeocodeFeature[] = [];

  // 1. Try Mapbox Search Places API
  try {
    let url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
      query.trim()
    )}&types=poi,address,neighborhood,locality,place&limit=5&access_token=${MAPBOX_ACCESS_TOKEN}`;

    if (proximityLat && proximityLng) {
      url += `&proximity=${proximityLng},${proximityLat}`;
    }

    const response = await axios.get(url, { timeout: 6000 });
    if (response.data?.features && response.data.features.length > 0) {
      return response.data.features;
    }
  } catch (error: any) {
    // Fall back to native Expo Location geocoding
  }

  // 2. Native Geocoder Fallback
  try {
    const nativeGeo = await Location.geocodeAsync(query.trim());
    if (nativeGeo && nativeGeo.length > 0) {
      nativeGeo.slice(0, 4).forEach((g, idx) => {
        results.push({
          id: `native-geo-${idx}`,
          place_name: query.trim(),
          text: query.trim(),
          center: [g.longitude, g.latitude],
        });
      });
      return results;
    }
  } catch {}

  return results;
}

/**
 * Calculates high-accuracy walking route geometry and ETA using Mapbox Directions API
 */
export async function mapboxGetWalkingRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<MapboxRouteResult | null> {
  try {
    const coordsString = `${startLng},${startLat};${endLng},${endLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordsString}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_ACCESS_TOKEN}`;

    const response = await axios.get(url, { timeout: 8000 });
    const route = response.data?.routes?.[0];

    if (route && route.geometry && route.geometry.coordinates) {
      const coordinates: RouteGeometryPoint[] = route.geometry.coordinates.map((pt: [number, number]) => ({
        latitude: pt[1],
        longitude: pt[0],
      }));

      const distanceMeters = Math.round(route.distance || 0);
      const durationMinutes = Math.max(1, Math.round((route.duration || 0) / 60));

      const steps = (route.legs?.[0]?.steps || []).map((step: any) => ({
        instruction: step.maneuver?.instruction || step.name || 'Proceed',
        distance: Math.round(step.distance || 0),
        duration: Math.round(step.duration || 0),
      }));

      const summary = route.legs?.[0]?.summary || 'Safe Walking Corridor';

      return {
        coordinates,
        distanceMeters,
        durationMinutes,
        summary,
        steps,
      };
    }
  } catch (error: any) {
    // Mapbox directions fallback
  }

  return null;
}

/**
 * Calculates distance in meters between two lat/lng points using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
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

/**
 * Calculates perpendicular distance (in meters) from a point P to a line segment AB
 */
function distancePointToSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const latFactor = 111139; // meters per degree lat
  const lngFactor = 111139 * Math.cos((pLat * Math.PI) / 180);

  const px = (pLng - aLng) * lngFactor;
  const py = (pLat - aLat) * latFactor;
  const bx = (bLng - aLng) * lngFactor;
  const by = (bLat - aLat) * latFactor;

  const segmentLengthSq = bx * bx + by * by;

  if (segmentLengthSq === 0) {
    return Math.sqrt(px * px + py * py);
  }

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segmentLengthSq));
  const projX = t * bx;
  const projY = t * by;

  const dx = px - projX;
  const dy = py - projY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks route deviation: calculates minimum distance in meters from user GPS to any route segment
 */
export function calculateRouteDeviationMeters(
  userLat: number,
  userLng: number,
  routePoints: RouteGeometryPoint[]
): number {
  if (!routePoints || routePoints.length < 2) return 0;

  let minDistance = Infinity;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const a = routePoints[i];
    const b = routePoints[i + 1];
    const dist = distancePointToSegment(
      userLat,
      userLng,
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return Math.round(minDistance === Infinity ? 0 : minDistance);
}
