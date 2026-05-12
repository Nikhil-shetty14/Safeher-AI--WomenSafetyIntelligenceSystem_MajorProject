import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, Dimensions,
} from 'react-native';
import MapView, { Marker, Circle, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { locationAPI, aiAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const { width } = Dimensions.get('window');

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0a1e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b8a9d9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0a1e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1535' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2d2050' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a0518' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export default function MapScreen() {
  const { user } = useAuth();
  const { sendLocation, isConnected } = useSocket();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<any>(null);
  const [tracking, setTracking] = useState(false);
  const [locationHistory, setLocationHistory] = useState<any[]>([]);
  const [riskLevel, setRiskLevel] = useState<string>('unknown');
  const [riskData, setRiskData] = useState<any>(null);
  const watchRef = useRef<any>(null);

  useEffect(() => {
    initLocation();
    return () => { if (watchRef.current) watchRef.current.remove(); };
  }, []);

  const initLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is required for map features.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation(loc.coords);
    analyzeAreaRisk(loc.coords.latitude, loc.coords.longitude);
  };

  const startTracking = async () => {
    setTracking(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      async (loc) => {
        const coords = loc.coords;
        setLocation(coords);
        setLocationHistory((prev) => [...prev.slice(-50), coords]);

        // Send to server + WebSocket
        sendLocation(coords.latitude, coords.longitude, coords.accuracy);
        try {
          await locationAPI.update({
            user_id: user?.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            speed: coords.speed,
          });
        } catch {}
      }
    );
  };

  const stopTracking = () => {
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    setTracking(false);
    setLocationHistory([]);
  };

  const analyzeAreaRisk = async (lat: number, lng: number) => {
    try {
      const res = await aiAPI.getAreaRisk(lat, lng);
      setRiskData(res.data);
      setRiskLevel(res.data.risk_level || 'unknown');
    } catch {}
  };

  const centerMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 800);
    }
  };

  const getRiskColor = (level: string) => {
    const map: Record<string, string> = {
      low: Colors.success, medium: Colors.warning, high: Colors.danger,
      critical: Colors.dangerDark, unknown: Colors.textMuted,
    };
    return map[level] || Colors.textMuted;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Map */}
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={{
            latitude: location.latitude, longitude: location.longitude,
            latitudeDelta: 0.015, longitudeDelta: 0.015,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* User marker */}
          <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="You are here">
            <View style={styles.markerOuter}>
              <View style={styles.markerInner} />
            </View>
          </Marker>

          {/* Risk radius */}
          <Circle
            center={{ latitude: location.latitude, longitude: location.longitude }}
            radius={300}
            fillColor={getRiskColor(riskLevel) + '20'}
            strokeColor={getRiskColor(riskLevel) + '80'}
            strokeWidth={2}
          />

          {/* Location trail */}
          {locationHistory.length > 1 && (
            <Polyline
              coordinates={locationHistory.map((l) => ({ latitude: l.latitude, longitude: l.longitude }))}
              strokeColor={Colors.primary}
              strokeWidth={3}
            />
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Ionicons name="location" size={48} color={Colors.primary} />
          <Text style={styles.mapPlaceholderText}>Getting your location...</Text>
        </View>
      )}

      {/* Header overlay */}
      <View style={styles.headerOverlay}>
        <Text style={styles.headerTitle}>📍 Live Map</Text>
        <View style={[styles.connBadge, { backgroundColor: isConnected ? Colors.success + '30' : Colors.warning + '30' }]}>
          <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.warning }]} />
          <Text style={[styles.connText, { color: isConnected ? Colors.success : Colors.warning }]}>
            {isConnected ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Risk Card */}
      {riskData && (
        <View style={styles.riskCard}>
          <View style={styles.riskLeft}>
            <Text style={styles.riskLabel}>Area Risk</Text>
            <Text style={[styles.riskLevel, { color: getRiskColor(riskLevel) }]}>
              {riskLevel.toUpperCase()}
            </Text>
            <Text style={styles.riskRec} numberOfLines={2}>{riskData.recommendation}</Text>
          </View>
          <Ionicons
            name={riskLevel === 'low' ? 'shield-checkmark' : riskLevel === 'medium' ? 'warning' : 'alert-circle'}
            size={40}
            color={getRiskColor(riskLevel)}
          />
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.centerBtn} onPress={centerMap}>
          <Ionicons name="locate" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.trackBtn, tracking && styles.trackBtnActive]}
          onPress={tracking ? stopTracking : startTracking}
        >
          <Ionicons name={tracking ? 'stop-circle' : 'radio-button-on'} size={20} color={Colors.white} />
          <Text style={styles.trackBtnText}>
            {tracking ? '  Stop Tracking' : '  Start Tracking'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  mapPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background, gap: 16,
  },
  mapPlaceholderText: { color: Colors.textSecondary, fontSize: Typography.fontSizeLG },
  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 55, paddingBottom: Spacing.sm,
    backgroundColor: Colors.background + 'CC',
  },
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  connBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, gap: 6 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  connText: { fontSize: Typography.fontSizeSM, fontWeight: Typography.fontWeightSemibold },
  riskCard: {
    position: 'absolute', bottom: 120, left: Spacing.lg, right: Spacing.lg,
    backgroundColor: Colors.card + 'EE', borderRadius: BorderRadius.lg, padding: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  riskLeft: { flex: 1 },
  riskLabel: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, fontWeight: Typography.fontWeightMedium },
  riskLevel: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightExtrabold },
  riskRec: { fontSize: Typography.fontSizeXS, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
  controls: {
    position: 'absolute', bottom: 40, right: Spacing.lg, gap: Spacing.sm, alignItems: 'flex-end',
  },
  centerBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '60',
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: BorderRadius.full,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  trackBtnActive: { backgroundColor: Colors.danger, shadowColor: Colors.danger },
  trackBtnText: { color: Colors.white, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeMD },
  markerOuter: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary + '40',
    justifyContent: 'center', alignItems: 'center',
  },
  markerInner: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary },
});
