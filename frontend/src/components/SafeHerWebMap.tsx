import React, { useRef, useImperativeHandle, forwardRef, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../constants/theme';
import { MapboxStyleType, MAPBOX_STYLES } from '../api/mapbox';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
}

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

export interface SafeHerWebMapRef {
  animateToRegion: (region: MapRegion, duration?: number) => void;
  fitToCoordinates: (
    coords: MapCoordinates[],
    options?: { edgePadding?: { top?: number; right?: number; bottom?: number; left?: number }; animated?: boolean }
  ) => void;
}

export interface WebMapDangerZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

export interface WebMapEmergencyService {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'women_center';
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  distance?: number;
  verified?: boolean;
}

interface SafeHerWebMapProps {
  initialRegion?: MapRegion;
  location?: MapCoordinates | null;
  sosTriggered?: boolean;
  dangerZones?: WebMapDangerZone[];
  emergencyServices?: WebMapEmergencyService[];
  activeFilters?: Record<string, boolean>;
  heatmapVisible?: boolean;
  safeTripMode?: boolean;
  routePolyline?: MapCoordinates[];
  mapStyle?: MapboxStyleType;
  onMapReady?: () => void;
  onSelectService?: (service: WebMapEmergencyService) => void;
  onSelectDangerZone?: (zone: WebMapDangerZone) => void;
  style?: StyleProp<ViewStyle>;
}

export const SafeHerWebMap = forwardRef<SafeHerWebMapRef, SafeHerWebMapProps>(
  (
    {
      initialRegion = { latitude: 37.422, longitude: -122.084, latitudeDelta: 0.015, longitudeDelta: 0.015 },
      location,
      sosTriggered = false,
      dangerZones = [],
      emergencyServices = [],
      activeFilters = { police: true, hospital: true, women_center: true },
      heatmapVisible = true,
      safeTripMode = false,
      routePolyline = [],
      mapStyle = 'safeher',
      onMapReady,
      onSelectService,
      onSelectDangerZone,
      style,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Delta to Leaflet zoom level approximation
    const deltaToZoom = (delta?: number): number => {
      if (!delta || delta <= 0) return 15;
      const zoom = Math.round(Math.log(360 / delta) / Math.LN2);
      return Math.min(Math.max(zoom, 3), 19);
    };

    // Imperative ref methods compatible with react-native-maps MapView API
    useImperativeHandle(ref, () => ({
      animateToRegion: (region: MapRegion) => {
        const zoom = deltaToZoom(region.latitudeDelta);
        const script = `if (window.map) { window.map.flyTo([${region.latitude}, ${region.longitude}], ${zoom}, { duration: 0.8 }); } true;`;
        webViewRef.current?.injectJavaScript(script);
      },
      fitToCoordinates: (coords: MapCoordinates[], options) => {
        if (!coords || coords.length === 0) return;
        const coordsJson = JSON.stringify(coords.map((c) => [c.latitude, c.longitude]));
        const padTop = options?.edgePadding?.top || 80;
        const padBottom = options?.edgePadding?.bottom || 180;
        const padLeft = options?.edgePadding?.left || 50;
        const padRight = options?.edgePadding?.right || 50;
        const script = `if (window.map) {
          var bounds = L.latLngBounds(${coordsJson});
          window.map.fitBounds(bounds, {
            paddingTopLeft: [${padLeft}, ${padTop}],
            paddingBottomRight: [${padRight}, ${padBottom}],
            animate: true
          });
        } true;`;
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    // Active tile URL (defaults to CARTO Dark for SafeHer cyber look)
    const tileUrl = useMemo(() => {
      const cfg = MAPBOX_STYLES[mapStyle];
      if (cfg && cfg.urlTemplate) {
        return cfg.urlTemplate;
      }
      return 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';
    }, [mapStyle]);

    // Send dynamic updates to WebView when props change
    useEffect(() => {
      if (!isLoaded) return;

      const payload = {
        type: 'UPDATE_DATA',
        location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
        sosTriggered,
        dangerZones: heatmapVisible ? dangerZones : [],
        emergencyServices: emergencyServices.filter((s) => activeFilters[s.type]),
        safeTripMode,
        routePolyline,
        tileUrl,
      };

      const script = `if (window.handleNativeUpdate) {
        window.handleNativeUpdate(${JSON.stringify(payload)});
      } true;`;
      webViewRef.current?.injectJavaScript(script);
    }, [
      isLoaded,
      location,
      sosTriggered,
      dangerZones,
      emergencyServices,
      activeFilters,
      heatmapVisible,
      safeTripMode,
      routePolyline,
      tileUrl,
    ]);

    // HTML payload with Leaflet & Cyber Aesthetic
    const htmlContent = useMemo(() => {
      const initLat = location?.latitude ?? initialRegion.latitude;
      const initLng = location?.longitude ?? initialRegion.longitude;
      const initZoom = deltaToZoom(initialRegion.latitudeDelta);

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; background: #0A0614; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    
    /* Hide Leaflet default attribution & zoom controls for clean app chrome */
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }

    /* Custom Live User Beacon Marker */
    .user-marker {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-pulse {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(139, 92, 246, 0.35);
      border: 1.5px solid #8b5cf6;
      animation: pulseAnim 2s infinite ease-out;
    }
    .user-pulse-sos {
      background: rgba(239, 68, 68, 0.45) !important;
      border-color: #ef4444 !important;
      animation: pulseSos 1s infinite ease-out !important;
    }
    .user-core {
      position: relative;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #8b5cf6;
      border: 2.5px solid #ffffff;
      box-shadow: 0 0 12px #8b5cf6, 0 0 24px rgba(139, 92, 246, 0.8);
    }
    .user-core-sos {
      background: #ef4444 !important;
      box-shadow: 0 0 16px #ef4444, 0 0 30px rgba(239, 68, 68, 0.9) !important;
    }

    @keyframes pulseAnim {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    @keyframes pulseSos {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.9); opacity: 0; }
    }

    /* Danger Zone Badge */
    .danger-badge {
      display: flex;
      align-items: center;
      gap: 3px;
      background: #dc2626;
      color: #ffffff;
      padding: 3px 7px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0,0,0,0.6), 0 0 10px rgba(220, 38, 38, 0.6);
      border: 1px solid rgba(255,255,255,0.4);
      white-space: nowrap;
      cursor: pointer;
    }

    /* Emergency Service Badges */
    .service-badge {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      cursor: pointer;
      transition: transform 0.2s;
    }
    .service-badge:active {
      transform: scale(1.2);
    }
    .service-police {
      background: #2563eb;
      box-shadow: 0 0 12px rgba(37, 99, 235, 0.8);
    }
    .service-hospital {
      background: #dc2626;
      box-shadow: 0 0 12px rgba(220, 38, 38, 0.8);
    }
    .service-women {
      background: #8b5cf6;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.8);
    }
    .service-icon {
      width: 18px;
      height: 18px;
      fill: #ffffff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map;
    var tileLayer;
    var userMarker = null;
    var sosCircle = null;
    var dangerCircles = [];
    var dangerMarkers = [];
    var serviceMarkers = [];
    var routePolylineOuter = null;
    var routePolylineInner = null;

    var currentTileUrl = "${tileUrl}";

    function initMap() {
      try {
        map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true
        }).setView([${initLat}, ${initLng}], ${initZoom});

        tileLayer = L.tileLayer(currentTileUrl, {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c', 'd']
        }).addTo(map);

        tileLayer.on('tileerror', function() {
          // Fallback to OSM standard if tile provider fails
          if (!tileLayer._isFallback) {
            tileLayer._isFallback = true;
            tileLayer.setUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
          }
        });

        // Notify React Native that Map is Ready
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
        }

        // Map Click Listener
        map.on('click', function(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'MAP_CLICK',
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
          }
        });
      } catch (e) {
        console.error('Map init error:', e);
      }
    }

    // SVG icons for services
    var shieldSvg = '<svg class="service-icon" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>';
    var medicalSvg = '<svg class="service-icon" viewBox="0 0 24 24"><path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19v-3z"/></svg>';
    var heartSvg = '<svg class="service-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

    // Native Data Update Handler
    window.handleNativeUpdate = function(data) {
      if (!map) return;

      // 1. Switch Tile URL if changed
      if (data.tileUrl && data.tileUrl !== currentTileUrl && tileLayer) {
        currentTileUrl = data.tileUrl;
        tileLayer.setUrl(currentTileUrl);
      }

      // 2. User Live Location Marker
      if (data.location && typeof data.location.latitude === 'number') {
        var uLat = data.location.latitude;
        var uLng = data.location.longitude;
        var isSos = Boolean(data.sosTriggered);

        var pulseClass = isSos ? 'user-pulse user-pulse-sos' : 'user-pulse';
        var coreClass = isSos ? 'user-core user-core-sos' : 'user-core';
        var userHtml = '<div class="user-marker"><div class="' + pulseClass + '"></div><div class="' + coreClass + '"></div></div>';

        var userIcon = L.divIcon({
          className: '',
          html: userHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });

        if (!userMarker) {
          userMarker = L.marker([uLat, uLng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        } else {
          userMarker.setLatLng([uLat, uLng]);
          userMarker.setIcon(userIcon);
        }

        // SOS Geofence Radius
        if (isSos) {
          if (!sosCircle) {
            sosCircle = L.circle([uLat, uLng], {
              radius: 400,
              color: '#ef4444',
              fillColor: 'rgba(239, 68, 68, 0.22)',
              fillOpacity: 0.22,
              weight: 2
            }).addTo(map);
          } else {
            sosCircle.setLatLng([uLat, uLng]);
          }
        } else if (sosCircle) {
          map.removeLayer(sosCircle);
          sosCircle = null;
        }
      }

      // 3. AI Danger Zones
      dangerCircles.forEach(function(c) { map.removeLayer(c); });
      dangerMarkers.forEach(function(m) { map.removeLayer(m); });
      dangerCircles = [];
      dangerMarkers = [];

      if (data.dangerZones && data.dangerZones.length > 0) {
        data.dangerZones.forEach(function(zone) {
          var color = zone.risk === 'critical' ? '#dc2626' : (zone.risk === 'high' ? '#ef4444' : '#f59e0b');
          var fillOp = zone.risk === 'critical' ? 0.28 : 0.20;

          var circle = L.circle([zone.latitude, zone.longitude], {
            radius: zone.radius || 180,
            color: color,
            fillColor: color,
            fillOpacity: fillOp,
            weight: 2
          }).addTo(map);
          dangerCircles.push(circle);

          var badgeHtml = '<div class="danger-badge">⚠️ ' + (zone.score || 80) + '%</div>';
          var badgeIcon = L.divIcon({
            className: '',
            html: badgeHtml,
            iconSize: [60, 24],
            iconAnchor: [30, 12]
          });

          var marker = L.marker([zone.latitude, zone.longitude], { icon: badgeIcon }).addTo(map);
          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'DANGER_ZONE_CLICK',
                zone: zone
              }));
            }
          });
          dangerMarkers.push(marker);
        });
      }

      // 4. Emergency Services Markers
      serviceMarkers.forEach(function(m) { map.removeLayer(m); });
      serviceMarkers = [];

      if (data.emergencyServices && data.emergencyServices.length > 0) {
        data.emergencyServices.forEach(function(serv) {
          var cls = serv.type === 'police' ? 'service-police' : (serv.type === 'hospital' ? 'service-hospital' : 'service-women');
          var svg = serv.type === 'police' ? shieldSvg : (serv.type === 'hospital' ? medicalSvg : heartSvg);

          var servHtml = '<div class="service-badge ' + cls + '">' + svg + '</div>';
          var servIcon = L.divIcon({
            className: '',
            html: servHtml,
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });

          var sMarker = L.marker([serv.latitude, serv.longitude], { icon: servIcon, zIndexOffset: 500 }).addTo(map);
          sMarker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SERVICE_CLICK',
                service: serv
              }));
            }
          });
          serviceMarkers.push(sMarker);
        });
      }

      // 5. Safe Route Polylines
      if (routePolylineOuter) { map.removeLayer(routePolylineOuter); routePolylineOuter = null; }
      if (routePolylineInner) { map.removeLayer(routePolylineInner); routePolylineInner = null; }
      if (window.destMarker) { map.removeLayer(window.destMarker); window.destMarker = null; }

      if (data.safeTripMode && data.routePolyline && data.routePolyline.length > 1) {
        var latLngs = data.routePolyline.map(function(p) { return [p.latitude, p.longitude]; });

        // Outer glow path
        routePolylineOuter = L.polyline(latLngs, {
          color: '#10b981',
          opacity: 0.35,
          weight: 9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Inner sharp path
        routePolylineInner = L.polyline(latLngs, {
          color: '#10b981',
          opacity: 1,
          weight: 4.5,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Destination Marker
        var lastPt = data.routePolyline[data.routePolyline.length - 1];
        var destHtml = '<div style="width:34px;height:34px;background:#10b981;border:2px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px #10b981;"><svg style=\\"width:18px;height:18px;fill:#ffffff\\" viewBox=\\"0 0 24 24\\"><path d=\\"M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z\\"/></svg></div>';
        var destIcon = L.divIcon({
          className: '',
          html: destHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        window.destMarker = L.marker([lastPt.latitude, lastPt.longitude], { icon: destIcon, zIndexOffset: 800 }).addTo(map);
      }
    };

    window.onload = function() {
      initMap();
    };
  </script>
</body>
</html>`;
    }, []);

    const handleMessage = (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'MAP_READY') {
          setIsLoaded(true);
          onMapReady?.();
        } else if (msg.type === 'SERVICE_CLICK') {
          onSelectService?.(msg.service);
        } else if (msg.type === 'DANGER_ZONE_CLICK') {
          onSelectDangerZone?.(msg.zone);
        }
      } catch (err) {
        console.warn('Map message parse error:', err);
      }
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onMessage={handleMessage}
          onLoadEnd={() => setIsLoaded(true)}
        />
        {!isLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Initializing SafeHer Satellite Basemap...</Text>
          </View>
        )}
      </View>
    );
  }
);

SafeHerWebMap.displayName = 'SafeHerWebMap';

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0614',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0A0614',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0614',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
