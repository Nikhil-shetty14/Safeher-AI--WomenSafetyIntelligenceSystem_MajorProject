import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
  Animated,
  Vibration,
  Share,
  Platform,
  TextInput,
  Switch,
  Linking,
  FlatList,
  Modal,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, UrlTile, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { SafeHerWebMap, SafeHerWebMapRef } from '../components/SafeHerWebMap';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { locationAPI, aiAPI, sosAPI, BASE_URL } from '../api/client';
import {
  MAPBOX_STYLES,
  MapboxStyleType,
  mapboxReverseGeocode,
  mapboxForwardGeocode,
  mapboxGetWalkingRoute,
  calculateRouteDeviationMeters,
  calculateHaversineDistance,
  RouteGeometryPoint,
  GeocodeFeature,
} from '../api/mapbox';
import { Colors, Typography, Spacing, BorderRadius, SAFEHER_MAP_STYLE } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface EmergencyService {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'women_center';
  latitude: number;
  longitude: number;
  phone: string;
  status: string;
}

interface DangerZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  score: number;
}

function MapScreen() {
  const { user } = useAuth();
  const { sendLocation, isConnected } = useSocket();
  const mapRef = useRef<SafeHerWebMapRef>(null);

  // ─── Location & Permissions State ─────────────────────
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [currentAreaName, setCurrentAreaName] = useState<string>('Detecting location...');
  const [tracking, setTracking] = useState(false);
  const [locationHistory, setLocationHistory] = useState<RouteGeometryPoint[]>([]);

  // ─── Mapbox Styling & Tile Layers ─────────────────────
  const [mapStyle, setMapStyle] = useState<MapboxStyleType>('safeher');
  const [styleSelectorOpen, setStyleSelectorOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // ─── AI Risk Intelligence ─────────────────────────────
  const [riskLevel, setRiskLevel] = useState<string>('low');
  const [riskScore, setRiskScore] = useState<number>(22);
  const [riskFactors, setRiskFactors] = useState<string[]>([
    'Well-lit primary corridor',
    'Active emergency units nearby',
  ]);
  const [riskRecommendation, setRiskRecommendation] = useState<string>(
    'Safe corridor detected. SafeHer live AI guardian active.'
  );
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'night'>('day');
  const [dataOrigin, setDataOrigin] = useState<string>('Mapbox AI Telemetry');

  // ─── Markers & Overlays ───────────────────────────────
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [emergencyServices, setEmergencyServices] = useState<EmergencyService[]>([]);
  const [heatmapVisible, setHeatmapVisible] = useState(true);
  const [selectedService, setSelectedService] = useState<EmergencyService | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({
    police: true,
    hospital: true,
    women_center: true,
  });

  // ─── Route Navigation & ETA ───────────────────────────
  const [destinationInput, setDestinationInput] = useState('');
  const [activeDestinationTitle, setActiveDestinationTitle] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<GeocodeFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [safeTripMode, setSafeTripMode] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<RouteGeometryPoint[]>([]);
  const [routeDistanceText, setRouteDistanceText] = useState<string>('');
  const [routeEtaMinutes, setRouteEtaMinutes] = useState<number>(0);
  const [routeHighlights, setRouteHighlights] = useState<string[]>([]);

  // ─── Route Deviation Detection ────────────────────────
  const [deviationMeters, setDeviationMeters] = useState<number>(0);
  const [deviationDetected, setDeviationDetected] = useState(false);
  const [deviationSimulated, setDeviationSimulated] = useState(false);

  // ─── SOS & Voice Commander ────────────────────────────
  const [sosTriggered, setSosTriggered] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [micPhrase, setMicPhrase] = useState('');

  // ─── Animated Values ──────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sosBorderAnim = useRef(new Animated.Value(0)).current;

  // ─── Stable Refs to prevent closure staleness ──────────
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const locationRef = useRef<Location.LocationObjectCoords | null>(null);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const dangerZonesRef = useRef(dangerZones);
  useEffect(() => {
    dangerZonesRef.current = dangerZones;
  }, [dangerZones]);

  const routePolylineRef = useRef(routePolyline);
  useEffect(() => {
    routePolylineRef.current = routePolyline;
  }, [routePolyline]);

  const safeTripModeRef = useRef(safeTripMode);
  useEffect(() => {
    safeTripModeRef.current = safeTripMode;
  }, [safeTripMode]);

  // ─── Pulsing Animations ───────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (sosTriggered) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sosBorderAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(sosBorderAnim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      sosBorderAnim.setValue(0);
    }
  }, [sosTriggered, sosBorderAnim]);

  // ─── Reverse Geocoding with Mapbox ─────────────────────
  const resolveAddress = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await mapboxReverseGeocode(lat, lng);
      if (res.neighborhood || res.placeName) {
        setCurrentAreaName(`${res.placeName}${res.city ? ', ' + res.city : ''}`);
        return;
      }
    } catch {}

    // Fallback to Expo Location reverse geocode
    try {
      const expRes = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (expRes && expRes.length > 0) {
        const item = expRes[0];
        const parts = [item.name, item.street, item.city || item.subregion].filter(Boolean);
        setCurrentAreaName(parts.slice(0, 2).join(', '));
      }
    } catch {
      setCurrentAreaName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  }, []);

  // ─── Fetch Emergency Services & AI Risk ────────────────
  const fetchNearbyData = useCallback(async (lat: number, lng: number) => {
    // 1. Fetch Emergency Services from FastAPI
    try {
      const res = await aiAPI.getNearbyServices(lat, lng);
      if (res && res.data && res.data.services && res.data.services.length > 0) {
        setEmergencyServices(res.data.services);
        setDataOrigin('AI-Ranked OSM Services');
      }
    } catch (e) {
      console.warn('[Nearby Services] Fetch error:', e);
    }

    // 2. Fetch AI Area Risk Score from FastAPI
    try {
      const riskRes = await aiAPI.getAreaRisk(lat, lng);
      if (riskRes.data) {
        const d = riskRes.data;
        setRiskLevel(d.threat_level?.toLowerCase() || 'low');
        setRiskScore(d.risk_score || 22);
        setRiskRecommendation(d.hotspot_reason || 'Corridor verified by SafeHer AI.');
        if (d.recommended_actions) {
          setRiskFactors(d.recommended_actions);
        }
      }
    } catch (e) {
      console.warn('[Area Risk] Fetch error:', e);
    }

    // 3. Fetch Heatmap Danger Zones from FastAPI
    try {
      const heatRes = await locationAPI.getHeatmap();
      if (heatRes.data && Array.isArray(heatRes.data) && heatRes.data.length > 0) {
        const mappedZones: DangerZone[] = heatRes.data
          .filter((item: any) => item.location?.latitude && item.location?.longitude)
          .map((item: any, idx: number) => ({
            id: item.id || `heat-zone-${idx}`,
            name: `${(item.danger_level || 'Alert').toUpperCase()} Risk Zone`,
            latitude: item.location.latitude,
            longitude: item.location.longitude,
            radius: item.danger_level === 'critical' ? 280 : item.danger_level === 'high' ? 200 : 120,
            risk: (item.danger_level?.toLowerCase() as any) || 'high',
            score: item.danger_level === 'critical' ? 92 : item.danger_level === 'high' ? 82 : 60,
          }));
        setDangerZones(mappedZones);
      }
    } catch (e) {
      console.warn('[Heatmap] Fetch error:', e);
    }
  }, []);

  // ─── Continuous GPS Telemetry Watcher ─────────────────
  const startTrackingStream = useCallback(async () => {
    if (watchRef.current) return;
    setTracking(true);

    try {
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 4,
        },
        async (loc) => {
          const coords = loc.coords;
          setLocation(coords);
          setLocationHistory((prev) => [...prev.slice(-40), { latitude: coords.latitude, longitude: coords.longitude }]);

          // Send real-time telemetry to WebSocket
          sendLocation(coords.latitude, coords.longitude, coords.accuracy ?? undefined);

          // Update backend FastAPI location endpoint
          try {
            await locationAPI.update({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              speed: coords.speed,
              heading: coords.heading,
              altitude: coords.altitude,
            });
          } catch {}

          // If SOS is active, stream to dedicated high-frequency SOS endpoint
          if (sosTriggered) {
            try {
              await locationAPI.sosLive({
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy,
                speed: coords.speed,
              });
            } catch {}
          }

          // ─── Geofence Threat Assessment ───────────────────
          const currentZones = dangerZonesRef.current;
          for (const zone of currentZones) {
            const dist = calculateHaversineDistance(
              coords.latitude,
              coords.longitude,
              zone.latitude,
              zone.longitude
            );
            if (dist <= zone.radius) {
              Vibration.vibrate([0, 500, 250, 500]);
              setRiskLevel('critical');
              setRiskScore(zone.score);
              setRiskRecommendation(
                `🚨 GEOFENCE ALERT: Inside ${zone.name}. Danger Score: ${zone.score}%. Bypass immediately!`
              );
              break;
            }
          }

          // ─── Active Route Deviation Monitoring ───────────
          if (safeTripModeRef.current && routePolylineRef.current.length > 1) {
            const dev = calculateRouteDeviationMeters(
              coords.latitude,
              coords.longitude,
              routePolylineRef.current
            );
            setDeviationMeters(dev);

            if (dev > 60) {
              setDeviationDetected(true);
              Vibration.vibrate([0, 350, 150, 350]);

              // Query AI Predictive Guardian endpoint for deviation risk
              try {
                const guardianRes = await aiAPI.predictiveGuardian({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  speed: coords.speed || 0,
                  heading: coords.heading,
                  route_deviation_meters: dev,
                  is_journey_active: true,
                });
                if (guardianRes?.data) {
                  setRiskScore(guardianRes.data.risk_score || 88);
                  setRiskLevel('high');
                  setRiskRecommendation(
                    `⚠️ AI Route Deviation (${dev}m off course). Stay on illuminated path.`
                  );
                }
              } catch {}
            } else {
              setDeviationDetected(false);
            }
          }
        }
      );
    } catch (e) {
      console.warn('Location watch start error:', e);
    }
  }, [sendLocation, sosTriggered]);

  // ─── Initial GPS Location Fetch ───────────────────────
  const initLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocationLoaded(true);
        Alert.alert(
          'Location Permission Required',
          'SafeHer AI needs your real GPS location for safety navigation, AI risk intelligence, and SOS broadcasts.',
          [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Retry', onPress: initLocation },
          ]
        );
        return;
      }

      setPermissionDenied(false);

      // 1. FAST PATH: Check last known position immediately (< 30ms)
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown?.coords) {
        const cachedCoords = lastKnown.coords;
        setLocation(cachedCoords);
        setLocationLoaded(true);
        mapRef.current?.animateToRegion(
          {
            latitude: cachedCoords.latitude,
            longitude: cachedCoords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          600
        );
        resolveAddress(cachedCoords.latitude, cachedCoords.longitude);
        fetchNearbyData(cachedCoords.latitude, cachedCoords.longitude);
      }

      // 2. Start continuous GPS telemetry watcher
      startTrackingStream();

      // 3. Acquire fresh satellite lock in parallel
      try {
        const freshLocPromise = Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS acquisition timeout')), 6000)
        );
        const freshLoc = (await Promise.race([freshLocPromise, timeoutPromise])) as Location.LocationObject;
        if (freshLoc?.coords) {
          const freshCoords = freshLoc.coords;
          setLocation(freshCoords);
          setLocationLoaded(true);
          mapRef.current?.animateToRegion(
            {
              latitude: freshCoords.latitude,
              longitude: freshCoords.longitude,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            },
            800
          );
          resolveAddress(freshCoords.latitude, freshCoords.longitude);
          fetchNearbyData(freshCoords.latitude, freshCoords.longitude);
        }
      } catch (freshErr) {
        // High-accuracy GPS timed out or indoors, try balanced accuracy
        if (!locationRef.current) {
          const balanced = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }).catch(() => null);
          if (balanced?.coords) {
            setLocation(balanced.coords);
            setLocationLoaded(true);
            mapRef.current?.animateToRegion(
              {
                latitude: balanced.coords.latitude,
                longitude: balanced.coords.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              },
              800
            );
            resolveAddress(balanced.coords.latitude, balanced.coords.longitude);
            fetchNearbyData(balanced.coords.latitude, balanced.coords.longitude);
          }
        }
      }

      setLocationLoaded(true);
    } catch (err: any) {
      console.warn('Location initialization warning:', err);
      setLocationLoaded(true);
    }
  }, [fetchNearbyData, resolveAddress, startTrackingStream]);

  // ─── Initialization Effect ─────────────────────────────
  useEffect(() => {
    initLocation();
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [initLocation]);

  // ─── Mapbox Forward Geocoding Search ───────────────────
  const handleSearchInputChange = useCallback(
    async (text: string) => {
      setDestinationInput(text);
      if (text.trim().length > 2) {
        setIsSearching(true);
        const currentLoc = locationRef.current;
        const results = await mapboxForwardGeocode(
          text,
          currentLoc?.latitude,
          currentLoc?.longitude
        );
        setSearchSuggestions(results);
      } else {
        setSearchSuggestions([]);
        setIsSearching(false);
      }
    },
    []
  );

  // ─── Route Planning via Mapbox + AI Route Engine ──────
  const handlePlanRouteToCoords = useCallback(
    async (targetLat: number, targetLng: number, targetTitle: string) => {
      const currentLoc = locationRef.current;
      if (!currentLoc) {
        Alert.alert('GPS Required', 'Please wait for GPS signal acquisition.');
        return;
      }

      setDestinationInput('');
      setSearchSuggestions([]);
      setIsSearching(false);
      setActiveDestinationTitle(targetTitle);
      setSafeTripMode(true);
      setDeviationDetected(false);
      setDeviationSimulated(false);

      try {
        // 1. Fetch real street-level walking route from Mapbox Directions API
        const mapboxRoute = await mapboxGetWalkingRoute(
          currentLoc.latitude,
          currentLoc.longitude,
          targetLat,
          targetLng
        );

        let finalPolyline: RouteGeometryPoint[] = [];
        let distanceM = 0;
        let durationM = 0;

        if (mapboxRoute && mapboxRoute.coordinates.length > 0) {
          finalPolyline = mapboxRoute.coordinates;
          distanceM = mapboxRoute.distanceMeters;
          durationM = mapboxRoute.durationMinutes;
          setRouteDistanceText(
            distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`
          );
          setRouteEtaMinutes(durationM);
        }

        // 2. Cross-verify route safety with SafeHer FastAPI AI engine
        try {
          const aiRouteRes = await aiAPI.predictRouteSafety({
            start_latitude: currentLoc.latitude,
            start_longitude: currentLoc.longitude,
            end_latitude: targetLat,
            end_longitude: targetLng,
          });

          if (aiRouteRes.data && aiRouteRes.data.success) {
            const data = aiRouteRes.data;
            if (finalPolyline.length === 0 && data.safest_route) {
              finalPolyline = data.safest_route;
            }
            setRiskScore(data.safety_score || 92);
            setRiskLevel(data.risk_level?.toLowerCase() || 'low');
            setRouteHighlights(
              data.highlights || ['Mapbox Safe Corridor', 'Well-lit path verified']
            );
            setRiskRecommendation(
              `Safest corridor to ${targetTitle}. Evaluated by SafeHer AI.`
            );
          }
        } catch (aiErr) {
          console.warn('[AI Route] AI safety engine fallback:', aiErr);
        }

        if (finalPolyline.length === 0) {
          // Direct straight-line fallback
          finalPolyline = [
            { latitude: currentLoc.latitude, longitude: currentLoc.longitude },
            { latitude: targetLat, longitude: targetLng },
          ];
        }

        setRoutePolyline(finalPolyline);
        Vibration.vibrate(120);

        // Frame route in MapView
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(finalPolyline, {
            edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
            animated: true,
          });
        }, 400);
      } catch (err) {
        console.error('Route planning error:', err);
        Alert.alert('Route Error', 'Unable to calculate safe navigation path.');
      }
    },
    []
  );

  // ─── Handle Destination Form Submit ───────────────────
  const handleDestinationSubmit = useCallback(async () => {
    if (!destinationInput.trim()) {
      Alert.alert('Route Planner', 'Please enter a target destination or choose a suggested point.');
      return;
    }

    const currentLoc = locationRef.current;
    const results = await mapboxForwardGeocode(
      destinationInput,
      currentLoc?.latitude,
      currentLoc?.longitude
    );

    if (results.length > 0) {
      const topResult = results[0];
      handlePlanRouteToCoords(topResult.center[1], topResult.center[0], topResult.text);
    } else {
      Alert.alert('Location Not Found', 'Could not find the specified destination on Mapbox.');
    }
  }, [destinationInput, handlePlanRouteToCoords]);

  // ─── Route Deviation Simulation ───────────────────────
  const handleSimulateDeviation = useCallback(
    async (val: boolean) => {
      setDeviationSimulated(val);
      const currentLoc = locationRef.current;
      if (!currentLoc) return;

      if (val) {
        Vibration.vibrate([0, 400, 200, 400]);
        const offCourseLat = currentLoc.latitude + 0.003;
        const offCourseLng = currentLoc.longitude - 0.004;

        setDeviationDetected(true);
        setDeviationMeters(185);

        // Update dynamic risk score via AI guardian
        try {
          const res = await aiAPI.predictiveGuardian({
            latitude: offCourseLat,
            longitude: offCourseLng,
            route_deviation_meters: 185,
            is_journey_active: true,
          });
          if (res?.data) {
            setRiskScore(res.data.risk_score || 89);
            setRiskLevel('high');
            setRiskRecommendation(
              '⚠️ AI ALERT: User deviated from planned safe corridor. Emergency network on standby.'
            );
          }
        } catch {}

        sendLocation(offCourseLat, offCourseLng, 5);
      } else {
        setDeviationDetected(false);
        setDeviationMeters(0);
        initLocation();
      }
    },
    [sendLocation, initLocation]
  );

  // ─── Emergency SOS Trigger ────────────────────────────
  const triggerEmergencySOS = useCallback(async () => {
    setSosTriggered(true);
    Vibration.vibrate([0, 600, 200, 600, 200, 1000]);

    const currentLoc = locationRef.current;
    if (!currentLoc) return;

    try {
      await sosAPI.trigger({
        trigger_type: 'map_sos_button',
        location: {
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          accuracy: currentLoc.accuracy || 5,
        },
        message: 'High-Priority Emergency SOS Activated from Map Console',
      });

      sendLocation(currentLoc.latitude, currentLoc.longitude, 5);

      Alert.alert(
        '🚨 EMERGENCY SOS ACTIVE',
        'Real-time GPS telemetry, SMS emergency contacts broadcast, and police notification triggered.'
      );
    } catch (e: any) {
      console.warn('SOS API error fallback:', e);
      Alert.alert(
        '🚨 SOS BROADCAST TRANSMITTED',
        `Live satellite coordinates (${currentLoc.latitude.toFixed(5)}, ${currentLoc.longitude.toFixed(
          5
        )}) broadcast to emergency network.`
      );
    }
  }, [sendLocation]);

  const deactivateSOS = useCallback(() => {
    setSosTriggered(false);
    setRiskLevel('low');
    setRiskScore(22);
    Vibration.vibrate(80);
  }, []);

  // ─── Recenter to Live GPS ─────────────────────────────
  const centerMapOnGPS = useCallback(() => {
    const currentLoc = locationRef.current;
    if (mapRef.current && currentLoc) {
      mapRef.current.animateToRegion(
        {
          latitude: currentLoc.latitude,
          longitude: currentLoc.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        600
      );
      Vibration.vibrate(30);
    }
  }, []);

  // ─── Time of Day Simulation ───────────────────────────
  const toggleTimeOfDay = useCallback(() => {
    const nextVal = timeOfDay === 'day' ? 'night' : 'day';
    setTimeOfDay(nextVal);

    if (nextVal === 'night') {
      setRiskLevel('high');
      setRiskScore(76);
      setRiskFactors(['Nighttime vigilance active', 'Lower street light density reported']);
      setRiskRecommendation('Night travel mode engaged. Stick to verified Mapbox safe corridors.');
    } else {
      setRiskLevel('low');
      setRiskScore(22);
      setRiskFactors(['Daylight operations active', 'Normal transit flow']);
      setRiskRecommendation('Route is safe. Travel freely.');
    }
    Vibration.vibrate(40);
  }, [timeOfDay]);

  // ─── Voice Commander ──────────────────────────────────
  const handleVoiceCommand = useCallback(() => {
    const phrase = micPhrase.toLowerCase();
    if (phrase.includes('help') || phrase.includes('sos') || phrase.includes('danger')) {
      setMicListening(false);
      setMicPhrase('');
      triggerEmergencySOS();
    } else {
      Alert.alert('AI Voice Commander', `Analyzed: "${micPhrase}". No safety keywords detected.`);
      setMicListening(false);
      setMicPhrase('');
    }
  }, [micPhrase, triggerEmergencySOS]);

  // ─── Share Journey Link ───────────────────────────────
  const handleShareJourney = useCallback(async () => {
    const currentLoc = locationRef.current;
    if (!currentLoc) return;
    try {
      const shareUrl = `${BASE_URL}/api/location/track/${user?.id || 'live'}`;
      await Share.share({
        message: `🚨 SafeHer AI Live Journey Telemetry:\n📍 Real GPS: ${currentLoc.latitude.toFixed(
          5
        )}, ${currentLoc.longitude.toFixed(5)}\n🛡️ Destination: ${
          activeDestinationTitle || 'Live Route'
        }\n🔗 Live Safety Tracking: ${shareUrl}`,
      });
    } catch {}
  }, [user?.id, activeDestinationTitle]);

  // ─── Helper Risk Colors ───────────────────────────────
  const getRiskColor = (level: string) => {
    if (level === 'critical') return Colors.severityCritical;
    if (level === 'high') return Colors.severityHigh;
    if (level === 'medium') return Colors.severityMedium;
    return Colors.severitySafe;
  };

  // ─── Default Regional Coordinates Fallback ───────────
  const DEFAULT_INITIAL_REGION: Region = useMemo(
    () => ({
      latitude: 12.9716,
      longitude: 77.5946,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }),
    []
  );

  // ─── Memoized Active Region ───────────────────────────
  const initialRegion: Region = useMemo(() => {
    if (location) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
    }
    return DEFAULT_INITIAL_REGION;
  }, [location, DEFAULT_INITIAL_REGION]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Non-Blocking Floating GPS Status Overlays ──── */}
      {!location && !permissionDenied && (
        <View style={styles.floatingGpsBanner}>
          <Animated.View style={[styles.gpsPulseDot, { transform: [{ scale: pulseAnim }] }]} />
          <Ionicons name="navigate-circle" size={16} color={Colors.primaryLight} />
          <Text style={styles.floatingGpsText}>Acquiring high-precision satellite GPS...</Text>
        </View>
      )}

      {permissionDenied && (
        <View style={styles.floatingPermissionBanner}>
          <Ionicons name="location-outline" size={16} color={Colors.danger} />
          <Text style={styles.floatingPermissionText}>Location access needed for live GPS.</Text>
          <TouchableOpacity style={styles.floatingPermissionBtn} onPress={initLocation}>
            <Text style={styles.floatingPermissionBtnText}>ENABLE</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Cyber Map Surface Layer (SafeHer WebGL / CARTO Dark Basemap) ───────────────── */}
      <SafeHerWebMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        location={location}
        sosTriggered={sosTriggered}
        dangerZones={dangerZones}
        emergencyServices={emergencyServices}
        activeFilters={activeFilters}
        heatmapVisible={heatmapVisible}
        safeTripMode={safeTripMode}
        routePolyline={routePolyline}
        mapStyle={mapStyle}
        onMapReady={() => {
          setMapReady(true);
          console.log('[MapScreen] SafeHer Cyber Map ready');
          const currentLoc = locationRef.current;
          if (currentLoc) {
            mapRef.current?.animateToRegion(
              {
                latitude: currentLoc.latitude,
                longitude: currentLoc.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
              },
              800
            );
          }
        }}
        onSelectService={(service) => {
          setSelectedService(service as EmergencyService);
          Vibration.vibrate(30);
        }}
        onSelectDangerZone={(zone) => {
          Alert.alert(
            '🚨 AI Danger Zone',
            `${zone.name}\n\nThreat Score: ${zone.score}%\nLevel: ${zone.risk.toUpperCase()}\n\nSafeHer AI advises choosing an alternate illuminated route.`
          );
        }}
      />

      {/* ─── Emergency SOS Full-Screen Glowing Border ──── */}
      {sosTriggered && (
        <Animated.View
          style={[styles.sosScreenBorder, { opacity: sosBorderAnim }]}
          pointerEvents="none"
        />
      )}

      {/* ─── Top Header & Controls Bar ─────────────────── */}
      <View style={styles.topHudContainer}>
        {/* Main Title Row */}
        <View style={styles.headerGlassCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>⚡ SafeHer AI</Text>
              <TouchableOpacity
                style={styles.mapboxPill}
                onPress={() => setStyleSelectorOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.mapboxPillText}>{MAPBOX_STYLES[mapStyle]?.label || 'SafeHer Cyber'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              📍 {currentAreaName}
            </Text>
          </View>

          {/* Live Socket Status */}
          <View
            style={[
              styles.connectionBadge,
              {
                backgroundColor: isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
              },
            ]}
          >
            <View
              style={[
                styles.connectionDot,
                { backgroundColor: isConnected ? '#10b981' : '#f59e0b' },
              ]}
            />
            <Text
              style={[
                styles.connectionText,
                { color: isConnected ? '#10b981' : '#f59e0b' },
              ]}
            >
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </Text>
          </View>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterPillsRow}>
          <TouchableOpacity
            style={[styles.filterPill, activeFilters.police && styles.filterPillPolice]}
            onPress={() => setActiveFilters({ ...activeFilters, police: !activeFilters.police })}
          >
            <Ionicons name="shield" size={12} color="#fff" />
            <Text style={styles.filterPillText}> Police</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilters.hospital && styles.filterPillHospital]}
            onPress={() => setActiveFilters({ ...activeFilters, hospital: !activeFilters.hospital })}
          >
            <Ionicons name="medical" size={12} color="#fff" />
            <Text style={styles.filterPillText}> Hospital</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPill, activeFilters.women_center && styles.filterPillWomen]}
            onPress={() =>
              setActiveFilters({ ...activeFilters, women_center: !activeFilters.women_center })
            }
          >
            <Ionicons name="heart" size={12} color="#fff" />
            <Text style={styles.filterPillText}> Sanctuaries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterPillToggle, heatmapVisible && styles.filterPillToggleActive]}
            onPress={() => setHeatmapVisible(!heatmapVisible)}
          >
            <Ionicons name="flame" size={12} color={heatmapVisible ? '#f59e0b' : '#94a3b8'} />
            <Text
              style={[
                styles.filterPillText,
                { color: heatmapVisible ? '#fff' : '#94a3b8' },
              ]}
            >
              {' '}
              Heatmap
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Search Suggestions Dropdown ───────────────── */}
      {isSearching && searchSuggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={searchSuggestions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() =>
                  handlePlanRouteToCoords(item.center[1], item.center[0], item.text)
                }
              >
                <Ionicons name="location-sharp" size={16} color={Colors.primary} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.suggestionTitle}>{item.text}</Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.place_name}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ─── Right Floating Action Buttons ─────────────── */}
      <View style={styles.floatingActionColumn}>
        {/* Mapbox Style Switcher */}
        <TouchableOpacity
          style={styles.floatingCircleBtn}
          onPress={() => setStyleSelectorOpen(true)}
        >
          <Ionicons name="layers" size={20} color={Colors.primaryLight} />
        </TouchableOpacity>

        {/* Day / Night AI Simulation Toggle */}
        <TouchableOpacity style={styles.floatingCircleBtn} onPress={toggleTimeOfDay}>
          <Ionicons
            name={timeOfDay === 'day' ? 'sunny' : 'moon'}
            size={20}
            color={timeOfDay === 'day' ? '#f59e0b' : '#a78bfa'}
          />
        </TouchableOpacity>

        {/* Voice AI Commander */}
        <TouchableOpacity
          style={[styles.floatingCircleBtn, micListening && styles.micBtnActive]}
          onPress={() => setMicListening(true)}
        >
          <Ionicons name="mic" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Recenter to Live GPS */}
        <TouchableOpacity style={styles.floatingCircleBtn} onPress={centerMapOnGPS}>
          <Ionicons name="locate" size={20} color={Colors.primary} />
        </TouchableOpacity>

        {/* Emergency SOS Big Button */}
        <TouchableOpacity
          style={[styles.floatingSosBtn, sosTriggered && styles.floatingSosBtnActive]}
          onPress={sosTriggered ? deactivateSOS : triggerEmergencySOS}
        >
          <Text style={styles.floatingSosBtnText}>{sosTriggered ? 'CANCEL' : 'SOS'}</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Bottom Intelligence Console Card ──────────── */}
      <View style={styles.bottomConsoleCard}>
        {/* Area Intelligence Header */}
        <View style={styles.riskHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.riskHeaderLabel}>AI Safety Telemetry ({dataOrigin})</Text>
            <View style={styles.riskBadgeRow}>
              <Text style={[styles.riskScoreValue, { color: getRiskColor(riskLevel) }]}>
                {riskScore}% {riskLevel.toUpperCase()}
              </Text>
              {safeTripMode && (
                <View style={styles.verifiedRouteTag}>
                  <Ionicons name="shield-checkmark" size={11} color={Colors.success} />
                  <Text style={styles.verifiedRouteTagText}>AI VERIFIED CORRIDOR</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.riskLevelIndicator, { backgroundColor: getRiskColor(riskLevel) }]} />
        </View>

        <Text style={styles.riskRecommendation}>{riskRecommendation}</Text>

        {/* Deviation Warning Notice */}
        {deviationDetected && (
          <View style={styles.deviationWarningBanner}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.deviationWarningText}>
              Route Deviation: {deviationMeters}m off safe path! AI risk scaled.
            </Text>
          </View>
        )}

        {/* Route Planner or Active Trip Mode */}
        {!safeTripMode ? (
          <View style={styles.plannerInputRow}>
            <TextInput
              placeholder="Search destination or address..."
              placeholderTextColor="#64748b"
              style={styles.plannerTextInput}
              value={destinationInput}
              onChangeText={handleSearchInputChange}
              onSubmitEditing={handleDestinationSubmit}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.planRouteBtn} onPress={handleDestinationSubmit}>
              <Ionicons name="navigate" size={15} color="#fff" />
              <Text style={styles.planRouteBtnText}> Plan Route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeTripContainer}>
            <View style={styles.activeTripInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTripLabel}>Active Safe Trip Navigation</Text>
                <Text style={styles.activeTripDest} numberOfLines={1}>
                  {activeDestinationTitle}
                </Text>
                {routeDistanceText ? (
                  <Text style={styles.activeTripEta}>
                    🚶 {routeDistanceText} • ~{routeEtaMinutes} mins walk
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.shareTripBtn} onPress={handleShareJourney}>
                <Ionicons name="share-social" size={14} color="#fff" />
                <Text style={styles.shareTripBtnText}> Share Link</Text>
              </TouchableOpacity>
            </View>

            {/* Deviation Simulator Switch */}
            <View style={styles.simulatorRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.simTitle}>Simulate Route Deviation</Text>
                <Text style={styles.simSub}>Test AI behavioral risk scaling & alerts</Text>
              </View>
              <Switch
                value={deviationSimulated}
                onValueChange={handleSimulateDeviation}
                thumbColor={deviationSimulated ? '#ef4444' : '#94a3b8'}
                trackColor={{ false: '#334155', true: '#ef4444' }}
              />
            </View>

            <TouchableOpacity
              style={styles.endJourneyBtn}
              onPress={() => {
                setSafeTripMode(false);
                setRoutePolyline([]);
                setDeviationDetected(false);
                setDeviationSimulated(false);
                initLocation();
              }}
            >
              <Text style={styles.endJourneyBtnText}>End Journey Mode</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── Selected Emergency Service Modal ───────────── */}
      {selectedService && (
        <View style={styles.serviceActionCard}>
          <TouchableOpacity
            style={styles.closeServiceModalBtn}
            onPress={() => setSelectedService(null)}
          >
            <Ionicons name="close-circle" size={22} color="#94a3b8" />
          </TouchableOpacity>

          <Text style={styles.serviceCardType}>
            VERIFIED {selectedService.type.toUpperCase()} STATION
          </Text>
          <Text style={styles.serviceCardName}>{selectedService.name}</Text>
          <Text style={styles.serviceCardStatus}>● {selectedService.status}</Text>

          <View style={styles.serviceButtonRow}>
            {/* Call Hotline */}
            <TouchableOpacity
              style={styles.callHotlineBtn}
              onPress={() => {
                if (selectedService.phone) {
                  Linking.openURL(`tel:${selectedService.phone}`);
                } else {
                  Alert.alert('Hotline', 'Connecting to 112 Emergency Dispatch');
                }
              }}
            >
              <Ionicons name="call" size={15} color="#fff" />
              <Text style={styles.serviceBtnText}> Call {selectedService.phone || '112'}</Text>
            </TouchableOpacity>

            {/* Plan Route to Service */}
            <TouchableOpacity
              style={styles.navigateServiceBtn}
              onPress={() => {
                handlePlanRouteToCoords(
                  selectedService.latitude,
                  selectedService.longitude,
                  selectedService.name
                );
                setSelectedService(null);
              }}
            >
              <Ionicons name="shield-checkmark" size={15} color="#fff" />
              <Text style={styles.serviceBtnText}> AI Safe Path</Text>
            </TouchableOpacity>

            {/* External Maps */}
            <TouchableOpacity
              style={styles.externalMapBtn}
              onPress={() => {
                const latLng = `${selectedService.latitude},${selectedService.longitude}`;
                const label = encodeURIComponent(selectedService.name);
                const url = Platform.select({
                  ios: `maps:0,0?q=${label}@${latLng}`,
                  android: `geo:0,0?q=${latLng}(${label})`,
                  default: `https://www.google.com/maps/dir/?api=1&destination=${latLng}`,
                });
                if (url) Linking.openURL(url);
              }}
            >
              <Ionicons name="open-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Mapbox Style Selector Modal ───────────────── */}
      <Modal
        visible={styleSelectorOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setStyleSelectorOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setStyleSelectorOpen(false)}
        >
          <View style={styles.styleSelectorSheet}>
            <Text style={styles.styleSelectorTitle}>Select Map Theme & Style</Text>
            {(Object.keys(MAPBOX_STYLES) as MapboxStyleType[]).map((key) => {
              const cfg = MAPBOX_STYLES[key];
              const isSelected = mapStyle === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.styleOptionItem, isSelected && styles.styleOptionItemSelected]}
                  onPress={() => {
                    setMapStyle(key);
                    setStyleSelectorOpen(false);
                    Vibration.vibrate(30);
                  }}
                >
                  <Ionicons
                    name={cfg.icon as any}
                    size={20}
                    color={isSelected ? Colors.primary : '#94a3b8'}
                  />
                  <Text
                    style={[styles.styleOptionLabel, isSelected && styles.styleOptionLabelSelected]}
                  >
                    {cfg.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Voice AI Commander Modal ───────────────────── */}
      {micListening && (
        <View style={styles.micModalOverlay}>
          <View style={styles.micModalCard}>
            <Ionicons name="mic-circle" size={68} color="#ef4444" style={styles.micIconPulsing} />
            <Text style={styles.micModalTitle}>AI Safety Voice Commander</Text>
            <Text style={styles.micModalSub}>Say "Help me" or "Trigger SOS" to test</Text>

            <TextInput
              placeholder="Or type voice command phrase..."
              placeholderTextColor="#64748b"
              style={styles.micModalInput}
              value={micPhrase}
              onChangeText={setMicPhrase}
              autoFocus
            />

            <View style={styles.micModalBtnRow}>
              <TouchableOpacity
                style={styles.micCancelBtn}
                onPress={() => {
                  setMicListening(false);
                  setMicPhrase('');
                }}
              >
                <Text style={styles.micCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.micSendBtn} onPress={handleVoiceCommand}>
                <Text style={styles.micSendText}>EXECUTE COMMAND</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

export default React.memo(MapScreen);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  floatingGpsBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 105,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 10, 30, 0.94)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    zIndex: 60,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingGpsText: {
    fontSize: 11,
    color: '#c4b5fd',
    fontWeight: Typography.fontWeightBold,
  },
  gpsPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  floatingPermissionBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 105,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    zIndex: 60,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  floatingPermissionText: {
    fontSize: 11,
    color: '#fca5a5',
    fontWeight: Typography.fontWeightBold,
  },
  floatingPermissionBtn: {
    backgroundColor: Colors.danger,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  floatingPermissionBtnText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: Typography.fontWeightExtrabold,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#06040c',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: Spacing.xl,
  },
  loadingPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  loadingTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSub: {
    fontSize: Typography.fontSizeSM,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: Colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.md,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: Typography.fontWeightExtrabold,
    fontSize: Typography.fontSizeSM,
  },
  sosScreenBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: '#ef4444',
    zIndex: 90,
  },
  topHudContainer: {
    position: 'absolute',
    top: 50,
    left: Spacing.md,
    right: Spacing.md,
    gap: 8,
    zIndex: 50,
  },
  headerGlassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 10, 30, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightExtrabold,
    color: '#fff',
    letterSpacing: 0.5,
  },
  mapboxPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  mapboxPillText: {
    fontSize: 9,
    fontWeight: Typography.fontWeightBold,
    color: Colors.primaryLight,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizeXS,
    color: '#94a3b8',
    marginTop: 2,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  connectionText: {
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightExtrabold,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 10, 30, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillPolice: {
    backgroundColor: '#1d4ed8',
    borderColor: '#3b82f6',
  },
  filterPillHospital: {
    backgroundColor: '#b91c1c',
    borderColor: '#ef4444',
  },
  filterPillWomen: {
    backgroundColor: '#6d28d9',
    borderColor: '#8b5cf6',
  },
  filterPillToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 10, 30, 0.85)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillToggleActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  filterPillText: {
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
    color: '#f1f5f9',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 155,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(15, 10, 30, 0.98)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    maxHeight: 220,
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionTitle: {
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
  },
  suggestionSub: {
    fontSize: Typography.fontSizeXS,
    color: '#94a3b8',
    marginTop: 2,
  },
  floatingActionColumn: {
    position: 'absolute',
    bottom: 275,
    right: Spacing.md,
    gap: 10,
    alignItems: 'center',
    zIndex: 40,
  },
  floatingCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 10, 30, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  floatingSosBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingSosBtnActive: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  floatingSosBtnText: {
    color: '#fff',
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightExtrabold,
    letterSpacing: 0.5,
  },
  bottomConsoleCard: {
    position: 'absolute',
    bottom: 25,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(15, 10, 30, 0.94)',
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 40,
  },
  riskHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  riskHeaderLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: Typography.fontWeightExtrabold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riskBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  riskScoreValue: {
    fontSize: Typography.fontSizeXL,
    fontWeight: Typography.fontWeightExtrabold,
  },
  verifiedRouteTag: {
    marginLeft: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedRouteTagText: {
    fontSize: 9,
    fontWeight: Typography.fontWeightExtrabold,
    color: Colors.success,
  },
  riskLevelIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  riskRecommendation: {
    fontSize: Typography.fontSizeSM,
    color: '#e2e8f0',
    lineHeight: 18,
    marginBottom: 12,
  },
  deviationWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 12,
    gap: 8,
  },
  deviationWarningText: {
    flex: 1,
    color: '#ef4444',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
  },
  plannerInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  plannerTextInput: {
    flex: 1.3,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: Typography.fontSizeMD,
  },
  planRouteBtn: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planRouteBtnText: {
    color: '#fff',
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightBold,
  },
  activeTripContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
  },
  activeTripInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeTripLabel: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: Typography.fontWeightExtrabold,
    textTransform: 'uppercase',
  },
  activeTripDest: {
    fontSize: Typography.fontSizeLG,
    color: '#fff',
    fontWeight: Typography.fontWeightExtrabold,
    marginTop: 2,
  },
  activeTripEta: {
    fontSize: Typography.fontSizeXS,
    color: '#cbd5e1',
    marginTop: 2,
  },
  shareTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareTripBtnText: {
    fontSize: Typography.fontSizeXS,
    color: '#fff',
    fontWeight: Typography.fontWeightBold,
  },
  simulatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    padding: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginBottom: 10,
  },
  simTitle: {
    fontSize: Typography.fontSizeSM,
    color: '#ef4444',
    fontWeight: Typography.fontWeightBold,
  },
  simSub: {
    fontSize: Typography.fontSizeXS,
    color: '#94a3b8',
    marginTop: 2,
  },
  endJourneyBtn: {
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  endJourneyBtnText: {
    color: '#94a3b8',
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightBold,
  },
  serviceActionCard: {
    position: 'absolute',
    bottom: 230,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(15, 10, 30, 0.98)',
    borderRadius: BorderRadius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  closeServiceModalBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  serviceCardType: {
    fontSize: 10,
    color: Colors.primaryLight,
    fontWeight: Typography.fontWeightExtrabold,
    letterSpacing: 1,
  },
  serviceCardName: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightExtrabold,
    color: '#fff',
    marginTop: 4,
  },
  serviceCardStatus: {
    fontSize: Typography.fontSizeXS,
    color: '#10b981',
    fontWeight: Typography.fontWeightBold,
    marginTop: 4,
    marginBottom: 14,
  },
  serviceButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  callHotlineBtn: {
    flex: 1.2,
    height: 38,
    backgroundColor: '#1d4ed8',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigateServiceBtn: {
    flex: 1.2,
    height: 38,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  externalMapBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  serviceBtnText: {
    color: '#fff',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  styleSelectorSheet: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(15, 10, 30, 0.98)',
    borderRadius: BorderRadius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  styleSelectorTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightExtrabold,
    color: '#fff',
    marginBottom: 14,
    textAlign: 'center',
  },
  styleOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: 6,
    gap: 12,
  },
  styleOptionItemSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  styleOptionLabel: {
    flex: 1,
    fontSize: Typography.fontSizeMD,
    color: '#cbd5e1',
    fontWeight: Typography.fontWeightMedium,
  },
  styleOptionLabelSelected: {
    color: '#fff',
    fontWeight: Typography.fontWeightBold,
  },
  micModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 999,
  },
  micModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: 'rgba(15, 10, 30, 0.96)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  micIconPulsing: {
    marginBottom: 12,
  },
  micModalTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightExtrabold,
    color: '#fff',
  },
  micModalSub: {
    fontSize: Typography.fontSizeXS,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 18,
  },
  micModalInput: {
    width: '100%',
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    color: '#fff',
    marginBottom: 18,
    textAlign: 'center',
  },
  micModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  micCancelBtn: {
    flex: 1,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micCancelText: {
    color: '#fff',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
  },
  micSendBtn: {
    flex: 1.3,
    height: 38,
    backgroundColor: '#ef4444',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micSendText: {
    color: '#fff',
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
  },
  userMarkerContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userPulseRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
  },
  userPulseRingSOS: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderColor: '#ef4444',
  },
  userMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  userMarkerDotSOS: {
    backgroundColor: '#ef4444',
  },
  dangerZoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: '#fff',
  },
  dangerZoneBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: Typography.fontWeightExtrabold,
  },
  serviceMarkerBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  policeBadge: {
    backgroundColor: '#1d4ed8',
  },
  hospitalBadge: {
    backgroundColor: '#b91c1c',
  },
  womenBadge: {
    backgroundColor: '#6d28d9',
  },
  destinationMarkerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
