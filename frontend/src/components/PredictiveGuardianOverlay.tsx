import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Vibration,
  Dimensions, Modal, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { aiAPI, sosAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');

const POLL_INTERVAL_MS = 30000; // 30 seconds continuous monitoring

interface GuardianData {
  risk_score: number;
  threat_level: string;
  risk_factors: string[];
  recommendation: string;
  nearby_incidents: number;
  alert_triggered: boolean;
  nearest_safe_haven: {
    name: string;
    type: string;
    latitude: number;
    longitude: number;
    phone?: string;
  } | null;
  time_context: {
    hour: number;
    is_night: boolean;
    is_late_night: boolean;
  };
  route_context: {
    deviation_meters: number;
    journey_active: boolean;
  };
}

interface Props {
  navigation?: any;
}

export default function PredictiveGuardianOverlay({ navigation: navProp }: Props) {
  const navigation = navProp || useNavigation<any>();
  const { user } = useAuth();
  const { sendLocation, isConnected } = useSocket();

  const [guardianData, setGuardianData] = useState<GuardianData | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [lastDismissedScore, setLastDismissedScore] = useState(0);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<any>(null);
  const locationWatchRef = useRef<any>(null);

  // Pulse animation for warning
  useEffect(() => {
    if (showWarning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
    } else {
      pulseAnim.setValue(0);
      Animated.timing(slideAnim, { toValue: -120, duration: 300, useNativeDriver: true }).start();
    }
  }, [showWarning]);

  const fetchGuardianPrediction = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch {
        loc = await Location.getLastKnownPositionAsync();
      }
      if (!loc) return;

      const coords = loc.coords;

      const res = await aiAPI.predictiveGuardian({
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed || 0,
        heading: coords.heading || 0,
        route_deviation_meters: 0,
        is_journey_active: false,
      });

      if (res.data?.success) {
        const data: GuardianData = res.data;
        setGuardianData(data);

        // Show warning if threat is elevated
        const threatLevel = data.threat_level?.toUpperCase();
        if (threatLevel === 'HIGH' || threatLevel === 'CRITICAL') {
          // Only show again if the score increased significantly since last dismiss
          if (!dismissed || data.risk_score > lastDismissedScore + 15) {
            setShowWarning(true);
            setDismissed(false);
            Vibration.vibrate([0, 300, 150, 300]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        } else if (threatLevel === 'MEDIUM') {
          // Don't force-show for MEDIUM, but update silently
          if (showWarning && !dismissed) {
            // Threat decreased, auto-dismiss
            setShowWarning(false);
          }
        } else {
          setShowWarning(false);
          setDismissed(false);
        }

        // Send location update via socket
        sendLocation(coords.latitude, coords.longitude, coords.accuracy ?? undefined);
      }
    } catch (err) {
      console.warn('[Guardian] Prediction fetch failed:', err);
    }
  }, [dismissed, lastDismissedScore, showWarning]);

  // Start continuous monitoring
  useEffect(() => {
    // Initial check after 5s delay
    const initTimer = setTimeout(() => {
      fetchGuardianPrediction();
    }, 5000);

    // Continuous polling
    timerRef.current = setInterval(fetchGuardianPrediction, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (locationWatchRef.current) locationWatchRef.current.remove();
    };
  }, [fetchGuardianPrediction]);

  const handleImSafe = () => {
    setShowWarning(false);
    setDismissed(true);
    setLastDismissedScore(guardianData?.risk_score || 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRecalculateRoute = () => {
    setShowWarning(false);
    setShowFullModal(false);
    navigation.navigate('Map');
  };

  const handleSOS = () => {
    setShowWarning(false);
    setShowFullModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    navigation.navigate('SOS', { autoTrigger: true, triggerType: 'guardian' });
  };

  const handleNavigateToSafeHaven = () => {
    if (!guardianData?.nearest_safe_haven) return;
    const { latitude, longitude, name } = guardianData.nearest_safe_haven;
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${latitude},${longitude}`;
    const label = encodeURIComponent(name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latLng}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleCallSafeHaven = () => {
    const phone = guardianData?.nearest_safe_haven?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const getThreatColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return '#DC2626';
      case 'HIGH': return '#EF4444';
      case 'MEDIUM': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const getThreatIcon = (level: string): keyof typeof Ionicons.glyphMap => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return 'skull';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'alert-circle';
      default: return 'shield-checkmark';
    }
  };

  if (!guardianData) return null;

  const threatColor = getThreatColor(guardianData.threat_level);
  const threatIcon = getThreatIcon(guardianData.threat_level);
  const isElevated = ['HIGH', 'CRITICAL'].includes(guardianData.threat_level?.toUpperCase());

  return (
    <>
      {/* Floating Warning Banner - slides in from top */}
      {showWarning && (
        <Animated.View style={[s.warningBanner, { transform: [{ translateY: slideAnim }] }]}>
          <TouchableOpacity
            style={[s.warningInner, { borderColor: threatColor + '60' }]}
            activeOpacity={0.85}
            onPress={() => setShowFullModal(true)}
          >
            {/* Pulsing glow */}
            <Animated.View style={[s.pulseGlow, {
              backgroundColor: threatColor,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
            }]} />

            <View style={s.warningContent}>
              <View style={[s.threatIconBox, { backgroundColor: threatColor + '25' }]}>
                <Ionicons name={threatIcon} size={24} color={threatColor} />
              </View>
              <View style={s.warningTextBox}>
                <View style={s.warningTitleRow}>
                  <Text style={[s.warningTitle, { color: threatColor }]}>
                    ⚠ AI SAFETY WARNING
                  </Text>
                  <View style={[s.scoreBadge, { backgroundColor: threatColor + '20' }]}>
                    <Text style={[s.scoreText, { color: threatColor }]}>
                      {guardianData.risk_score}%
                    </Text>
                  </View>
                </View>
                <Text style={s.warningReason} numberOfLines={2}>
                  {guardianData.risk_factors?.[0] || 'Elevated threat detected in your area'}
                </Text>
                <Text style={s.warningAction} numberOfLines={1}>
                  {guardianData.recommendation}
                </Text>
              </View>
            </View>

            {/* Quick Action Buttons */}
            <View style={s.quickActions}>
              <TouchableOpacity style={[s.qBtn, s.qBtnSafe]} onPress={handleImSafe}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[s.qBtnText, { color: '#10B981' }]}>I'm Safe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.qBtn, s.qBtnRoute]} onPress={handleRecalculateRoute}>
                <Ionicons name="navigate" size={16} color="#8B5CF6" />
                <Text style={[s.qBtnText, { color: '#8B5CF6' }]}>Safe Route</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.qBtn, s.qBtnSOS]} onPress={handleSOS}>
                <Ionicons name="alert-circle" size={16} color="#fff" />
                <Text style={[s.qBtnText, { color: '#fff' }]}>SOS</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Full Detail Modal */}
      <Modal
        visible={showFullModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFullModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            {/* Header */}
            <View style={[s.modalHeader, { borderBottomColor: threatColor + '30' }]}>
              <View style={s.modalHeaderLeft}>
                <View style={[s.modalIconBox, { backgroundColor: threatColor + '20' }]}>
                  <Ionicons name="sparkles" size={22} color={threatColor} />
                </View>
                <View>
                  <Text style={s.modalTitle}>AI Predictive Safety Guardian</Text>
                  <Text style={s.modalSubtitle}>Real-Time Threat Intelligence</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowFullModal(false)}>
                <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Threat Level Display */}
            <View style={[s.threatDisplay, { backgroundColor: threatColor + '10', borderColor: threatColor + '30' }]}>
              <Ionicons name={threatIcon} size={36} color={threatColor} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: '800', letterSpacing: 1 }}>THREAT LEVEL</Text>
                <Text style={{ fontSize: 28, fontWeight: '900', color: threatColor, letterSpacing: 0.5 }}>
                  {guardianData.threat_level}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>Risk Score</Text>
                <Text style={{ fontSize: 32, fontWeight: '900', color: threatColor }}>{guardianData.risk_score}</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>/100</Text>
              </View>
            </View>

            {/* Risk Factors */}
            <Text style={s.sectionLabel}>RISK FACTORS DETECTED</Text>
            {guardianData.risk_factors.map((factor, i) => (
              <View key={i} style={s.factorRow}>
                <View style={[s.factorDot, { backgroundColor: threatColor }]} />
                <Text style={s.factorText}>{factor}</Text>
              </View>
            ))}

            {/* AI Recommendation */}
            <Text style={s.sectionLabel}>AI RECOMMENDATION</Text>
            <View style={[s.recommendBox, { borderLeftColor: threatColor }]}>
              <Ionicons name="bulb" size={18} color={Colors.primaryLight} />
              <Text style={s.recommendText}>{guardianData.recommendation}</Text>
            </View>

            {/* Context Info */}
            <View style={s.contextRow}>
              <View style={s.contextItem}>
                <Ionicons name="time" size={16} color={Colors.textMuted} />
                <Text style={s.contextLabel}>
                  {guardianData.time_context.is_late_night ? 'Late Night' : guardianData.time_context.is_night ? 'Nighttime' : 'Daytime'}
                </Text>
              </View>
              <View style={s.contextItem}>
                <Ionicons name="alert" size={16} color={guardianData.nearby_incidents > 0 ? Colors.danger : Colors.textMuted} />
                <Text style={s.contextLabel}>{guardianData.nearby_incidents} Nearby SOS</Text>
              </View>
              <View style={s.contextItem}>
                <Ionicons name="wifi" size={16} color={isConnected ? Colors.success : Colors.textMuted} />
                <Text style={s.contextLabel}>{isConnected ? 'Live' : 'Offline'}</Text>
              </View>
            </View>

            {/* Nearest Safe Haven */}
            {guardianData.nearest_safe_haven && (
              <>
                <Text style={s.sectionLabel}>NEAREST SAFE HAVEN</Text>
                <View style={s.safeHavenCard}>
                  <View style={s.safeHavenInfo}>
                    <Ionicons
                      name={guardianData.nearest_safe_haven.type === 'police' ? 'shield' : 'medical'}
                      size={20}
                      color={guardianData.nearest_safe_haven.type === 'police' ? '#3B82F6' : '#EF4444'}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.safeHavenName}>{guardianData.nearest_safe_haven.name}</Text>
                      <Text style={s.safeHavenType}>
                        {guardianData.nearest_safe_haven.type === 'police' ? 'Police Station' : 'Hospital / Medical'}
                      </Text>
                    </View>
                  </View>
                  <View style={s.safeHavenActions}>
                    {guardianData.nearest_safe_haven.phone && (
                      <TouchableOpacity style={s.shActionBtn} onPress={handleCallSafeHaven}>
                        <Ionicons name="call" size={16} color="#fff" />
                        <Text style={s.shActionText}>Call</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.shActionBtn, { backgroundColor: '#8B5CF6' }]} onPress={handleNavigateToSafeHaven}>
                      <Ionicons name="navigate" size={16} color="#fff" />
                      <Text style={s.shActionText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* Main Action Buttons */}
            <View style={s.mainActions}>
              <TouchableOpacity style={s.mainBtnSafe} onPress={() => { handleImSafe(); setShowFullModal(false); }}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={s.mainBtnSafeText}>I'm Safe</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.mainBtnRoute} onPress={handleRecalculateRoute}>
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={s.mainBtnRouteText}>Recalculate Safe Route</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.mainBtnSOS} onPress={handleSOS}>
                <Ionicons name="alert-circle" size={22} color="#fff" />
                <Text style={s.mainBtnSOSText}>TRIGGER SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  // Warning banner
  warningBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 50 : 35,
    left: 12, right: 12, zIndex: 9999, elevation: 50,
  },
  warningInner: {
    backgroundColor: 'rgba(15,10,32,0.96)', borderRadius: 16,
    borderWidth: 1, overflow: 'hidden',
    ...Shadows.card,
  },
  pulseGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 16,
  },
  warningContent: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
  },
  threatIconBox: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  warningTextBox: { flex: 1 },
  warningTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warningTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  scoreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  scoreText: { fontSize: 12, fontWeight: '900' },
  warningReason: { fontSize: 12, color: Colors.textSecondary, marginTop: 3, fontWeight: '600' },
  warningAction: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontStyle: 'italic' },

  quickActions: {
    flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8,
  },
  qBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10, gap: 5,
  },
  qBtnSafe: { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  qBtnRoute: { backgroundColor: 'rgba(139,92,246,0.12)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  qBtnSOS: { backgroundColor: '#EF4444' },
  qBtnText: { fontSize: 11, fontWeight: '800' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14, borderBottomWidth: 1, marginBottom: 16,
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  modalSubtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },

  threatDisplay: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderRadius: 14, borderWidth: 1, marginBottom: 18,
  },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.textMuted,
    letterSpacing: 1.5, marginBottom: 8, marginTop: 4,
  },

  factorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  factorDot: { width: 6, height: 6, borderRadius: 3 },
  factorText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', flex: 1 },

  recommendBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primaryLight + '10', padding: 12,
    borderRadius: 10, borderLeftWidth: 3, marginBottom: 14,
  },
  recommendText: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '600', lineHeight: 19 },

  contextRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: Colors.card, padding: 12, borderRadius: 10,
    marginBottom: 14,
  },
  contextItem: { alignItems: 'center', gap: 4 },
  contextLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },

  safeHavenCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 16,
  },
  safeHavenInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  safeHavenName: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  safeHavenType: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  safeHavenActions: { flexDirection: 'row', gap: 8 },
  shActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 10, borderRadius: 8,
    gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  shActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  mainActions: { gap: 10, marginTop: 8, marginBottom: Platform.OS === 'ios' ? 24 : 12 },
  mainBtnSafe: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.1)', paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', gap: 8,
  },
  mainBtnSafeText: { color: '#10B981', fontSize: 15, fontWeight: '800' },
  mainBtnRoute: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 12, gap: 8,
  },
  mainBtnRouteText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  mainBtnSOS: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EF4444', paddingVertical: 16, borderRadius: 12, gap: 8,
    shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  mainBtnSOSText: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
});
