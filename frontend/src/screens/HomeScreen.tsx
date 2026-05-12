import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { sosAPI, aiAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, Shadows, getSeverityColor } from '../constants/theme';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';

const SAFETY_TIPS = [
  { icon: '📍', tip: 'Share your live location before solo travel' },
  { icon: '🔒', tip: 'Set up emergency contacts with primary contact' },
  { icon: '🎙️', tip: 'Use voice SOS for hands-free emergency trigger' },
  { icon: '📳', tip: 'Enable shake-to-SOS in settings' },
  { icon: '🤖', tip: 'Chat with SafeHer AI for safety guidance' },
];

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [safetyScore, setSafetyScore] = useState(85);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
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
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const tipTimer = setInterval(() => setTipIndex((i) => (i + 1) % SAFETY_TIPS.length), 5000);
    
    // Shake-to-SOS detection
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastUpdate = 0;
    const SHAKE_THRESHOLD = 3000;

    const subscription = Accelerometer.addListener(accelerometerData => {
      let { x, y, z } = accelerometerData;
      let currTime = Date.now();
      if ((currTime - lastUpdate) > 100) {
        let diffTime = (currTime - lastUpdate);
        lastUpdate = currTime;
        let speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;

        if (speed > SHAKE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          navigation.navigate('SOS');
        }
        lastX = x; lastY = y; lastZ = z;
      }
    });
    Accelerometer.setUpdateInterval(100);

    return () => { 
      clearInterval(timer); 
      clearInterval(tipTimer); 
      subscription.remove();
    };
  }, []);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  };

  const loadData = async () => {
    try {
      const res = await sosAPI.getMyAlerts(0, 3);
      setRecentAlerts(res.data || []);
    } catch { }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return '🌅 Good Morning';
    if (h < 17) return '☀️ Good Afternoon';
    if (h < 21) return '🌇 Good Evening';
    return '🌙 Stay Safe Tonight';
  };

  const getSafetyColor = (score: number) =>
    score >= 80 ? Colors.success : score >= 60 ? Colors.warning : Colors.danger;

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
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'SafeHer'} 💜</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.warning }]} />
              <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle" size={38} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Safety Score Card */}
          <View style={styles.scoreCard}>
            <View style={styles.scoreLeft}>
              <Text style={styles.scoreLabel}>Safety Score</Text>
              <Text style={[styles.scoreValue, { color: getSafetyColor(safetyScore) }]}>{safetyScore}%</Text>
              <Text style={styles.scoreStatus}>
                {safetyScore >= 80 ? '✅ You are safe' : safetyScore >= 60 ? '⚠️ Stay Alert' : '🚨 High Risk'}
              </Text>
            </View>
            <Animated.View style={[styles.scoreRing, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="shield-checkmark" size={52} color={getSafetyColor(safetyScore)} />
            </Animated.View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {[
              { icon: 'alert-circle', label: 'SOS Alert', color: Colors.danger, screen: 'SOS' },
              { icon: 'map', label: 'Live Map', color: Colors.primary, screen: 'Map' },
              { icon: 'people', label: 'Contacts', color: Colors.accent, screen: 'Contacts' },
              { icon: 'chatbubbles', label: 'AI Chat', color: Colors.success, screen: 'Chat' },
              { icon: 'call', label: 'Fake Call', color: Colors.warning, screen: 'FakeCall' },
              { icon: 'timer', label: 'Safe Timer', color: '#06B6D4', screen: 'SafeTimer' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.quickCard, { borderColor: item.color + '40' }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(item.screen); }}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Safety Tip Ticker */}
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Safety Tip</Text>
            <Text style={styles.tipText}>
              {SAFETY_TIPS[tipIndex].icon} {SAFETY_TIPS[tipIndex].tip}
            </Text>
          </View>

          {/* Emergency Numbers */}
          <Text style={styles.sectionTitle}>Emergency Numbers 🇮🇳</Text>
          <View style={styles.emerGrid}>
            {[
              { num: '100', label: 'Police', color: Colors.primary },
              { num: '1091', label: "Women's Helpline", color: Colors.accent },
              { num: '112', label: 'National Emergency', color: Colors.danger },
              { num: '1098', label: 'Child Helpline', color: Colors.warning },
            ].map((item) => (
              <View key={item.num} style={[styles.emerCard, { borderLeftColor: item.color }]}>
                <Text style={[styles.emerNum, { color: item.color }]}>{item.num}</Text>
                <Text style={styles.emerLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Recent Alerts */}
          {recentAlerts.length > 0 && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent Alerts</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AlertHistory')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              {recentAlerts.slice(0, 2).map((alert) => (
                <View key={alert.id} style={styles.alertCard}>
                  <View style={[styles.alertDot, { backgroundColor: getSeverityColor(alert.severity) }]} />
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertType}>{alert.trigger_type?.toUpperCase()} Alert</Text>
                    <Text style={styles.alertTime}>{new Date(alert.created_at).toLocaleString()}</Text>
                  </View>
                  <View style={[styles.alertBadge, { backgroundColor: getSeverityColor(alert.severity) + '20' }]}>
                    <Text style={[styles.alertSeverity, { color: getSeverityColor(alert.severity) }]}>
                      {alert.severity?.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, paddingTop: 55,
  },
  greeting: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary, fontWeight: Typography.fontWeightMedium },
  userName: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightExtrabold, color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  connDot: { width: 8, height: 8, borderRadius: 4 },
  profileBtn: {},
  scoreCard: {
    margin: Spacing.lg, marginTop: 0, backgroundColor: Colors.card, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.cardBorder, ...Shadows.card,
  },
  scoreLeft: {},
  scoreLabel: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, fontWeight: Typography.fontWeightMedium },
  scoreValue: { fontSize: Typography.fontSize4XL, fontWeight: Typography.fontWeightExtrabold },
  scoreStatus: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 4 },
  scoreRing: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary, paddingHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  seeAll: { fontSize: Typography.fontSizeSM, color: Colors.primary, fontWeight: Typography.fontWeightSemibold },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  quickCard: {
    width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', borderWidth: 1, ...Shadows.card,
  },
  quickIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemibold, color: Colors.textPrimary },
  tipCard: {
    margin: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.primary, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tipTitle: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, marginBottom: 6, fontWeight: Typography.fontWeightSemibold },
  tipText: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, lineHeight: 22 },
  emerGrid: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  emerCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderWidth: 1, borderColor: Colors.cardBorder,
    gap: Spacing.md,
  },
  emerNum: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightExtrabold, width: 60 },
  emerLabel: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, flex: 1 },
  alertCard: {
    margin: Spacing.lg, marginTop: 0, backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  alertInfo: { flex: 1 },
  alertType: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemibold, color: Colors.textPrimary },
  alertTime: { fontSize: Typography.fontSizeXS, color: Colors.textMuted, marginTop: 2 },
  alertBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  alertSeverity: { fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightBold },
});
