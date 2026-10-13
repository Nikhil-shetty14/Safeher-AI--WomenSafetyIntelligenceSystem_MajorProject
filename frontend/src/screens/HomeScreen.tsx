import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, RefreshControl, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { sosAPI, contactsAPI, aiAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, Shadows, getSeverityColor } from '../constants/theme';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import NetInfo from '@react-native-community/netinfo';
import SOSButton from '../components/SOSButton';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isConnected, dangerAlerts } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locName, setLocName] = useState('Locating...');
  const [isOffline, setIsOffline] = useState(false);
  const [primaryContact, setPrimaryContact] = useState<any>(null);
  const [aiRisk, setAiRisk] = useState<any>(null);
  const [riskLoading, setRiskLoading] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    startPulse();
    loadData();
    checkNetwork();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    
    // Set up shake detection on focus, clean up on blur
    let subscription: any = null;
    const unsubscribeFocus = navigation.addListener('focus', () => {
      subscription = setupShakeDetection();
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
    });

    return () => { 
      clearInterval(timer); 
      unsubscribeFocus();
      unsubscribeBlur();
      if (subscription) subscription.remove();
    };
  }, [navigation, user]);

  const checkNetwork = () => {
    NetInfo.fetch().then(state => {
      setIsOffline(!state.isConnected);
    });
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return unsubscribe;
  };

  const setupShakeDetection = () => {
    const shakeEnabled = user?.safety_preferences?.shake_detection ?? true;
    if (!shakeEnabled) return null;

    let lastShake = 0;
    let localCount = 0;
    const sensitivity = user?.safety_preferences?.shake_sensitivity || 2.5;

    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > sensitivity && now - lastShake > 300) {
        lastShake = now;
        localCount++;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        
        if (localCount >= 3) {
          localCount = 0;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          navigation.navigate('SOS', { autoTrigger: true, triggerType: 'shake' });
        }
      }

      // Reset counter after 1.5s of inactivity
      setTimeout(() => {
        if (Date.now() - lastShake > 1500) {
          localCount = 0;
        }
      }, 1600);
    });

    return sub;
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      const [alertsRes, contactsRes] = await Promise.all([
        sosAPI.getMyAlerts(0, 3),
        contactsAPI.getAll()
      ]);
      setRecentAlerts(alertsRes.data || []);
      const primary = contactsRes.data?.find((c: any) => c.is_primary);
      if (primary) setPrimaryContact(primary);
    } catch { }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
        if (!loc) {
          setLocName('Location unavailable');
          setRiskLoading(false);
          return;
        }
        setLocation(loc);
        const reverseGeocode = await Location.reverseGeocodeAsync(loc.coords);
        if (reverseGeocode.length > 0) {
          setLocName(`${reverseGeocode[0].city || reverseGeocode[0].subregion}, ${reverseGeocode[0].region}`);
        } else {
          setLocName(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
        }
        // Fetch AI area risk using real backend data
        fetchAIRisk(loc.coords.latitude, loc.coords.longitude);
      } else {
        setLocName('GPS Disabled');
        setRiskLoading(false);
      }
    } catch {
      setLocName('Location Error');
      setRiskLoading(false);
    }
  };

  const fetchAIRisk = async (lat: number, lng: number) => {
    setRiskLoading(true);
    try {
      const res = await aiAPI.getAreaRisk(lat, lng);
      setAiRisk(res.data);
    } catch (err) {
      console.warn('AI Risk fetch failed', err);
      setAiRisk({ risk_level: 'medium', confidence: 0.5, factors: ['Unable to assess'], recommendation: 'Stay alert.' });
    } finally {
      setRiskLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    checkNetwork();
    setRefreshing(false);
  };

  const getAIRiskStatus = () => {
    const level = (aiRisk?.risk_level || 'medium').toLowerCase();
    if (level === 'safe' || level === 'low') return { label: 'SAFE', color: Colors.success, icon: 'shield-checkmark' as const, advice: 'Low risk area' };
    if (level === 'medium') return { label: 'MEDIUM', color: Colors.warning, icon: 'alert-circle' as const, advice: 'Stay cautious' };
    if (level === 'high') return { label: 'HIGH', color: Colors.danger, icon: 'warning' as const, advice: 'Be alert — elevated risk' };
    return { label: 'CRITICAL', color: Colors.severityCritical, icon: 'skull' as const, advice: 'Leave area immediately' };
  };

  const riskInfo = getAIRiskStatus();
  const hasActiveAlert = recentAlerts.some((a: any) => a.status === 'active');

  const handleSOSTrigger = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    navigation.navigate('SOS', { autoTrigger: true, triggerType: 'button' });
  };

  const handleCallContact = () => {
    if (primaryContact?.phone) {
      Linking.openURL(`tel:${primaryContact.phone}`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Welcome To SaferHer APP</Text>
              <Text style={styles.userName}>{user?.name || 'SafeHer User'} 🛡️</Text>
            </View>
            <View style={styles.headerRight}>
              {isOffline && (
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={12} color={Colors.white} />
                  <Text style={styles.offlineText}>Offline Mode</Text>
                </View>
              )}
              <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('NotificationHistory')}>
                <Ionicons name="notifications" size={26} color={Colors.textPrimary} />
                <View style={styles.bellBadge} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle" size={42} color={Colors.primaryLight} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── AI SAFETY GUARDIAN CARD ────────────────── */}
          <View style={guardianStyles.guardianCard}>
            <View style={guardianStyles.guardianHeader}>
              <View style={guardianStyles.guardianHeaderLeft}>
                <View style={[guardianStyles.guardianIcon, { backgroundColor: riskInfo.color + '20' }]}>
                  <Ionicons name="sparkles" size={20} color={riskInfo.color} />
                </View>
                <View>
                  <Text style={guardianStyles.guardianTitle}>AI Safety Guardian</Text>
                  <Text style={guardianStyles.guardianPowered}>Detect. Understand. Predict. Protect.</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AIIntelligence')} style={guardianStyles.aiLiveBadge}>
                <View style={[guardianStyles.aiLiveDot, { backgroundColor: riskInfo.color }]} />
                <Text style={[guardianStyles.aiLiveText, { color: riskInfo.color }]}>AI LIVE</Text>
              </TouchableOpacity>
            </View>

            {/* Risk Level */}
            <View style={[guardianStyles.riskBanner, { backgroundColor: riskInfo.color + '12', borderColor: riskInfo.color + '30' }]}>
              <Ionicons name={riskInfo.icon} size={28} color={riskInfo.color} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Current Risk Level</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: riskInfo.color, marginTop: 2 }}>
                  {riskLoading ? 'ANALYZING...' : riskInfo.label}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>Confidence</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: riskInfo.color }}>{aiRisk?.confidence ? `${Math.round(aiRisk.confidence * 100)}%` : '—'}</Text>
              </View>
            </View>

            {/* Status Grid */}
            <View style={guardianStyles.statusRow}>
              <View style={guardianStyles.statusItem}>
                <Ionicons name="navigate-circle" size={18} color={Colors.primaryLight} />
                <Text style={guardianStyles.statusLabel}>Journey</Text>
                <Text style={guardianStyles.statusValue}>{hasActiveAlert ? 'SOS ACTIVE' : 'Monitoring'}</Text>
              </View>
              <View style={[guardianStyles.statusDivider]} />
              <View style={guardianStyles.statusItem}>
                <Ionicons name="location" size={18} color={location ? Colors.success : Colors.textMuted} />
                <Text style={guardianStyles.statusLabel}>GPS</Text>
                <Text style={guardianStyles.statusValue} numberOfLines={1}>{locName}</Text>
              </View>
              <View style={[guardianStyles.statusDivider]} />
              <View style={guardianStyles.statusItem}>
                <Ionicons name="git-branch" size={18} color={Colors.primaryLight} />
                <Text style={guardianStyles.statusLabel}>Route</Text>
                <Text style={guardianStyles.statusValue}>Normal</Text>
              </View>
            </View>

            {/* AI Recommendation */}
            {aiRisk?.recommendation && !riskLoading && (
              <View style={guardianStyles.recommendationBox}>
                <Ionicons name="bulb" size={16} color={Colors.primaryLight} />
                <Text style={guardianStyles.recommendationText} numberOfLines={2}>
                  {aiRisk.recommendation}
                </Text>
              </View>
            )}
          </View>

          {/* AI HIGH/CRITICAL Warning Banner */}
          {!riskLoading && aiRisk && ['high', 'critical'].includes((aiRisk.risk_level || '').toLowerCase()) && (
            <View style={[guardianStyles.warningBanner, { borderLeftColor: riskInfo.color }]}>
              <Ionicons name="alert-circle" size={22} color={riskInfo.color} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: riskInfo.color, fontSize: 13, fontWeight: '800' }}>⚠ AI Threat Warning</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {aiRisk.factors?.[0] || riskInfo.advice}
                </Text>
              </View>
            </View>
          )}

          {/* Large Emergency SOS Button in Center */}
          <View style={styles.sosContainer}>
            <Animated.View style={[styles.sosWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <SOSButton onPress={handleSOSTrigger} onLongPress={handleSOSTrigger} />
            </Animated.View>
            <Text style={styles.sosHint}>TAP TO TRIGGER EMERGENCY PROTOCOL</Text>
          </View>

          {/* Quick Voice SOS & Silent Mode */}
          <View style={styles.quickAccessRow}>
             <TouchableOpacity 
               style={[styles.actionCard, { flex: 1, backgroundColor: Colors.danger + '15', borderColor: Colors.danger + '40' }]} 
               onPress={() => navigation.navigate('SOS', { mode: 'voice', autoVoice: true })}
             >
                <View style={[styles.iconBox, { backgroundColor: Colors.danger }]}>
                  <Ionicons name="mic" size={24} color={Colors.white} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Voice SOS</Text>
                  <Text style={styles.actionSub}>AI Voice Trigger</Text>
                </View>
             </TouchableOpacity>

             <TouchableOpacity 
               style={[styles.actionCard, { flex: 1 }]} 
               onPress={() => navigation.navigate('SOS', { mode: 'stealth', autoStealth: true })}
             >
                <View style={[styles.iconBox, { backgroundColor: Colors.textSecondary }]}>
                  <Ionicons name="eye-off" size={24} color={Colors.background} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Stealth Mode</Text>
                  <Text style={styles.actionSub}>Silent Trigger</Text>
                </View>
             </TouchableOpacity>
          </View>

          {/* Real-Time Danger Alerts from Socket */}
          {dangerAlerts && dangerAlerts.length > 0 && (
             <View style={styles.dangerAlertBox}>
                <Ionicons name="warning" size={24} color={Colors.danger} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.dangerAlertTitle}>Nearby Incident Detected</Text>
                  <Text style={styles.dangerAlertText}>Active SOS reported nearby. Stay alert.</Text>
                </View>
             </View>
          )}

          {/* AI Assistant & Check-In Timer */}
          <View style={styles.quickGrid}>
            {[
              { id: 'chat', icon: 'chatbubbles', title: 'AI Assistant', sub: 'Live Guidance', color: Colors.success, screen: 'Chat' },
              { id: 'timer', icon: 'timer', title: 'Safe Timer', sub: 'Auto Check-in', color: '#06B6D4', screen: 'SafeTimer' },
              { id: 'map', icon: 'map', title: 'Safe Route Map', sub: 'Live Tracking', color: Colors.primary, screen: 'Map' },
              { id: 'audio', icon: 'recording', title: 'Audio Evidence', sub: 'Start Record', color: Colors.warning, screen: 'SOS' },
              { id: 'complaint', icon: 'document-text', title: 'File Complaint', sub: 'Report Incident', color: '#8b5cf6', screen: 'SubmitComplaint' },
            ].map((item) => (
              <TouchableOpacity key={item.id} style={styles.gridItem} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(item.screen); }}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSub}>{item.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Emergency Contacts Quick Access */}
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactInfo}>
              <View style={styles.contactAvatar}>
                <Ionicons name="person" size={24} color={Colors.white} />
              </View>
              <View>
                <Text style={styles.contactName}>{primaryContact ? primaryContact.name : 'No Primary Contact'}</Text>
                <Text style={styles.contactPhone}>{primaryContact ? primaryContact.phone : 'Setup in Contacts'}</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.callBtn, !primaryContact && { opacity: 0.5 }]} 
              onPress={primaryContact ? handleCallContact : () => navigation.navigate('Contacts')}
            >
              <Ionicons name="call" size={20} color={Colors.white} />
              <Text style={styles.callBtnText}>{primaryContact ? 'CALL' : 'SETUP'}</Text>
            </TouchableOpacity>
          </View>

          {/* System Status Footer */}
          <View style={styles.systemStatusRow}>
            <View style={styles.sysTag}>
              <Ionicons name="phone-portrait" size={14} color={user?.safety_preferences?.shake_detection ? Colors.success : Colors.textMuted} />
              <Text style={styles.sysTagText}>Shake: {user?.safety_preferences?.shake_detection ? 'ON' : 'OFF'}</Text>
            </View>
            <View style={styles.sysTag}>
              <Ionicons name="server" size={14} color={isConnected ? Colors.success : Colors.danger} />
              <Text style={styles.sysTagText}>Live Sync: {isConnected ? 'Active' : 'Offline'}</Text>
            </View>
            <TouchableOpacity style={styles.sysTag} onPress={() => navigation.navigate('AlertHistory')}>
              <Ionicons name="time" size={14} color={Colors.primaryLight} />
              <Text style={styles.sysTagText}>Activity Log</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 10
  },
  greeting: { fontSize: Typography.fontSizeSM, color: Colors.primaryLight, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  userName: { fontSize: Typography.fontSize3XL, fontWeight: '900', color: Colors.textPrimary, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.danger, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  offlineText: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
  bellBtn: { position: 'relative', marginRight: 8, padding: 4 },
  bellBadge: { position: 'absolute', top: 4, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  profileBtn: {},

  sosContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  sosWrapper: { alignItems: 'center', justifyContent: 'center' },
  sosHint: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 20, letterSpacing: 2 },

  quickAccessRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.lg },
  actionCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 12, 
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, gap: 12, ...Shadows.card 
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  actionSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  dangerAlertBox: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg, backgroundColor: Colors.danger + '20',
    borderLeftWidth: 4, borderLeftColor: Colors.danger, borderRadius: BorderRadius.md, padding: 16,
    flexDirection: 'row', alignItems: 'center'
  },
  dangerAlertTitle: { color: Colors.dangerLight, fontSize: 14, fontWeight: '800' },
  dangerAlertText: { color: Colors.white, fontSize: 12, marginTop: 4 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  gridItem: { 
    width: '47%', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: BorderRadius.xl, 
    borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', marginBottom: Spacing.xs, ...Shadows.card
  },
  gridTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 12 },
  gridSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginLeft: Spacing.lg, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  contactCard: {
    marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, ...Shadows.card
  },
  contactInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  contactName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  contactPhone: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  callBtn: { flexDirection: 'row', backgroundColor: Colors.danger, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 6 },
  callBtnText: { color: Colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  systemStatusRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 30, paddingHorizontal: Spacing.lg },
  sysTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, borderWidth: 1, borderColor: Colors.cardBorder },
  sysTagText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
});

// ── AI Safety Guardian Styles ──────────────────
const guardianStyles = StyleSheet.create({
  guardianCard: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.primaryLight + '30',
    padding: Spacing.md, ...Shadows.card,
  },
  guardianHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  guardianHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guardianIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  guardianTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  guardianPowered: { fontSize: 10, color: Colors.textMuted, marginTop: 1, fontWeight: '600', letterSpacing: 0.5 },
  aiLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  aiLiveDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  aiLiveText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  riskBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: BorderRadius.lg,
    borderWidth: 1, marginBottom: 12,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  statusItem: { flex: 1, alignItems: 'center', gap: 4 },
  statusLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  statusValue: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700' },
  statusDivider: { width: 1, height: 30, backgroundColor: Colors.cardBorder },
  recommendationBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primaryLight + '10', padding: 10, borderRadius: BorderRadius.md, marginTop: 8,
  },
  recommendationText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  warningBanner: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: Colors.danger + '10', borderLeftWidth: 4,
    borderRadius: BorderRadius.md, padding: 12,
    flexDirection: 'row', alignItems: 'center',
  },
});
