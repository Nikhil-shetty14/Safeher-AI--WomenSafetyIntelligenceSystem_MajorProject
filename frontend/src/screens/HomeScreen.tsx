import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, RefreshControl, Linking, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { sosAPI, contactsAPI } from '../api/client';
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
  const [safetyScore, setSafetyScore] = useState(85);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locName, setLocName] = useState('Locating...');
  const [isOffline, setIsOffline] = useState(false);
  const [primaryContact, setPrimaryContact] = useState<any>(null);

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
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation(loc);
        const reverseGeocode = await Location.reverseGeocodeAsync(loc.coords);
        if (reverseGeocode.length > 0) {
          setLocName(`${reverseGeocode[0].city || reverseGeocode[0].subregion}, ${reverseGeocode[0].region}`);
        } else {
          setLocName(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
        }
      } else {
        setLocName('GPS Disabled');
      }
    } catch {
      setLocName('Location Error');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    checkNetwork();
    setRefreshing(false);
  };

  const getSafetyStatus = () => {
    if (safetyScore >= 80) return { label: 'SAFE', color: Colors.success, risk: 'Low Risk Area' };
    if (safetyScore >= 60) return { label: 'MEDIUM RISK', color: Colors.warning, risk: 'Be Cautious' };
    if (safetyScore >= 40) return { label: 'HIGH RISK', color: Colors.danger, risk: 'Unsafe Zone' };
    return { label: 'CRITICAL', color: Colors.severityCritical, risk: 'Leave Immediately' };
  };

  const safetyInfo = getSafetyStatus();

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

          {/* AI Intelligence Center Banner */}
          <TouchableOpacity 
            style={styles.aiBanner}
            onPress={() => navigation.navigate('AIIntelligence')}
            activeOpacity={0.8}
          >
            <View style={styles.aiBannerLeft}>
              <View style={styles.aiIconWrapper}>
                <Ionicons name="sparkles" size={22} color={Colors.primaryLight} />
              </View>
              <View>
                <Text style={styles.aiBannerTitle}>AI Intelligence Center</Text>
                <Text style={styles.aiBannerSub}>Powered by Ollama Local LLM</Text>
              </View>
            </View>
            <View style={styles.aiBadge}>
              <View style={styles.aiBadgeDot} />
              <Text style={styles.aiBadgeText}>AI LIVE</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.primaryLight} style={{marginLeft: 10}} />
          </TouchableOpacity>

          {/* AI Safety Status Indicator & GPS Card Combined */}
          <View style={styles.statusGrid}>
            <View style={[styles.statusCard, { borderColor: safetyInfo.color + '40' }]}>
              <Text style={styles.cardSubtitle}>AI Safety Status</Text>
              <Text style={[styles.statusMainText, { color: safetyInfo.color }]}>{safetyInfo.label}</Text>
              <Text style={styles.statusSubText}>{safetyInfo.risk}</Text>
              <View style={[styles.statusIndicator, { backgroundColor: safetyInfo.color }]} />
            </View>
            
            <View style={styles.statusCard}>
              <Text style={styles.cardSubtitle}>Live GPS</Text>
              <Text style={styles.locNameText} numberOfLines={1}>{locName}</Text>
              <Text style={styles.statusSubText}>
                {location ? `Acc: ±${Math.round(location.coords.accuracy || 0)}m` : 'Finding GPS...'}
              </Text>
              <Ionicons name="location" size={20} color={location ? Colors.primary : Colors.textMuted} style={styles.locIcon} />
            </View>
          </View>

          {/* Large Emergency SOS Button in Center */}
          <View style={styles.sosContainer}>
            <Animated.View style={[styles.sosWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <SOSButton onPress={handleSOSTrigger} onLongPress={handleSOSTrigger} />
            </Animated.View>
            <Text style={styles.sosHint}>TAP TO TRIGGER EMERGENCY PROTOCOL</Text>
          </View>

          {/* Quick Voice SOS & Silent Mode */}
          <View style={styles.quickAccessRow}>
             <TouchableOpacity style={[styles.actionCard, { flex: 1, backgroundColor: Colors.danger + '15', borderColor: Colors.danger + '40' }]} onPress={() => navigation.navigate('SOS')}>
                <View style={[styles.iconBox, { backgroundColor: Colors.danger }]}>
                  <Ionicons name="mic" size={24} color={Colors.white} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Voice SOS</Text>
                  <Text style={styles.actionSub}>AI Voice Trigger</Text>
                </View>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.actionCard, { flex: 1 }]} onPress={() => navigation.navigate('SOS')}>
                <View style={[styles.iconBox, { backgroundColor: Colors.textSecondary }]}>
                  <Ionicons name="eye-off" size={24} color={Colors.background} />
                </View>
                <View>
                  <Text style={styles.actionTitle}>Stealth Mode</Text>
                  <Text style={styles.actionSub}>Silent Trigger</Text>
                </View>
             </TouchableOpacity>
          </View>

          {/* Real-Time Danger Alerts */}
          {dangerAlerts && dangerAlerts.length > 0 && (
             <View style={styles.dangerAlertBox}>
                <Ionicons name="warning" size={24} color={Colors.danger} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.dangerAlertTitle}>Nearby Incident Detected</Text>
                  <Text style={styles.dangerAlertText}>High risk activity reported 2km away.</Text>
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
  
  statusGrid: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginTop: Spacing.md },
  
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.primaryLight + '40',
    ...Shadows.card
  },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight + '20', alignItems: 'center', justifyContent: 'center' },
  aiBannerTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  aiBannerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.danger + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: Colors.danger + '40' },
  aiBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.danger, marginRight: 6 },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.danger, letterSpacing: 0.5 },

  statusCard: { 
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.md, 
    borderWidth: 1, borderColor: Colors.cardBorder, ...Shadows.card, position: 'relative', overflow: 'hidden'
  },
  cardSubtitle: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  statusMainText: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  statusSubText: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusIndicator: { position: 'absolute', top: 0, right: 0, width: 4, height: '100%' },
  locNameText: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  locIcon: { position: 'absolute', right: 16, top: 16, opacity: 0.2 },

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
