import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Alert, Vibration, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { sosAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const TIMER_KEY = 'safeher_safe_timer';

export default function SafeTimerScreen({ navigation }: any) {
  const { user } = useAuth();
  const { emitSOS } = useSocket();
  const [minutes, setMinutes] = useState(15);
  const [destination, setDestination] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [showSetup, setShowSetup] = useState(true);
  const [showExtend, setShowExtend] = useState(false);
  const intervalRef = useRef<any>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = () => {
    if (!destination.trim()) {
      Alert.alert('Add Destination', 'Please enter where you are heading to activate the Safe Timer.');
      return;
    }
    const totalSeconds = minutes * 60;
    setRemaining(totalSeconds);
    setIsRunning(true);
    setShowSetup(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.timing(progressAnim, {
      toValue: 0, duration: totalSeconds * 1000, useNativeDriver: false,
    }).start();

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          triggerAutoSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const triggerAutoSOS = async () => {
    Vibration.vibrate([0, 500, 300, 500, 300, 500]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let loc = null;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        loc = pos.coords;
      }
      await sosAPI.trigger({
        user_id: user?.id,
        trigger_type: 'safe_timer',
        location: {
          latitude: loc?.latitude || 0,
          longitude: loc?.longitude || 0,
        },
        message: `⏰ Safe Timer expired! User did not arrive at "${destination}" in time.`,
      });
      emitSOS({ latitude: loc?.latitude || 0, longitude: loc?.longitude || 0 }, 'high');
    } catch { }
    Alert.alert('🚨 SOS Triggered', `You didn't reach "${destination}" in time. Emergency contacts have been alerted!`);
    setIsRunning(false);
    setShowSetup(true);
  };

  const markSafe = () => {
    clearInterval(intervalRef.current);
    progressAnim.stopAnimation();
    setIsRunning(false);
    setShowSetup(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('✅ Marked Safe!', 'Great! Emergency contacts will not be notified.');
  };

  const extendTime = (extraMins: number) => {
    const extra = extraMins * 60;
    setRemaining((p) => p + extra);
    setShowExtend(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getColor = () => {
    if (remaining > minutes * 30) return Colors.success;
    if (remaining > minutes * 10) return Colors.warning;
    return Colors.danger;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⏱️ Safe Timer</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {showSetup ? (
          /* ─── Setup Mode ─── */
          <View style={styles.setupCard}>
            <View style={styles.infoBox}>
              <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
              <Text style={styles.infoTitle}>How It Works</Text>
              <Text style={styles.infoText}>
                Set your destination and travel time. If you don't mark yourself safe when the timer
                runs out, <Text style={{ color: Colors.danger, fontWeight: '700' }}>SOS is automatically sent</Text> to your emergency contacts.
              </Text>
            </View>

            <Text style={styles.label}>Where are you going?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Home, College, MG Road..."
              placeholderTextColor={Colors.textMuted}
              value={destination}
              onChangeText={setDestination}
            />

            <Text style={styles.label}>Expected travel time</Text>
            <View style={styles.minuteRow}>
              {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.minuteChip, minutes === m && styles.minuteChipActive]}
                  onPress={() => setMinutes(m)}
                >
                  <Text style={[styles.minuteChipText, minutes === m && styles.minuteChipTextActive]}>
                    {m}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.startBtn} onPress={startTimer}>
              <Ionicons name="shield-checkmark" size={22} color={Colors.white} />
              <Text style={styles.startBtnText}>  Start Safe Timer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ─── Active Timer Mode ─── */
          <View style={styles.activeCard}>
            <Text style={styles.destText}>📍 Heading to: <Text style={{ color: Colors.primary }}>{destination}</Text></Text>

            <Animated.View style={[styles.timerRing, { transform: [{ scale: pulseAnim }], borderColor: getColor() }]}>
              <Text style={[styles.timerText, { color: getColor() }]}>{formatTime(remaining)}</Text>
              <Text style={styles.timerSub}>remaining</Text>
            </Animated.View>

            {remaining <= 60 && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={18} color={Colors.danger} />
                <Text style={styles.warningText}>  SOS will trigger in {remaining} seconds!</Text>
              </View>
            )}

            <TouchableOpacity style={styles.safeBtn} onPress={markSafe}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
              <Text style={styles.safeBtnText}>  ✅ I Arrived Safely</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.extendBtn} onPress={() => setShowExtend(true)}>
              <Ionicons name="add-circle" size={20} color={Colors.warning} />
              <Text style={styles.extendBtnText}>  Need More Time</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Extend Time Modal */}
      <Modal visible={showExtend} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add More Time</Text>
            {[5, 10, 15, 20].map((m) => (
              <TouchableOpacity key={m} style={styles.modalOption} onPress={() => extendTime(m)}>
                <Ionicons name="time" size={20} color={Colors.primary} />
                <Text style={styles.modalOptionText}>  +{m} minutes</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowExtend(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, paddingTop: 55,
  },
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, flexGrow: 1 },
  setupCard: { gap: Spacing.md },
  infoBox: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.primary + '40',
    marginBottom: Spacing.md,
  },
  infoTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  infoText: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  label: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, fontWeight: Typography.fontWeightSemibold, marginTop: 4 },
  textInput: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md,
    color: Colors.textPrimary, fontSize: Typography.fontSizeMD, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  minuteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  minuteChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: BorderRadius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  minuteChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  minuteChipText: { color: Colors.textSecondary, fontWeight: Typography.fontWeightSemibold },
  minuteChipTextActive: { color: Colors.white },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full,
    paddingVertical: 16, marginTop: Spacing.md,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  startBtnText: { color: Colors.white, fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold },
  activeCard: { alignItems: 'center', gap: Spacing.lg, paddingTop: 20 },
  destText: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, textAlign: 'center' },
  timerRing: {
    width: 220, height: 220, borderRadius: 110, borderWidth: 5,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.card, marginVertical: Spacing.md,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  timerText: { fontSize: 52, fontWeight: Typography.fontWeightExtrabold },
  timerSub: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, marginTop: 4 },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.danger + '20',
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.danger + '50',
  },
  warningText: { color: Colors.danger, fontWeight: Typography.fontWeightBold },
  safeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.success, borderRadius: BorderRadius.full, paddingVertical: 18, paddingHorizontal: 40,
    shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
    width: '100%',
  },
  safeBtnText: { color: Colors.white, fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightExtrabold },
  extendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: BorderRadius.full, paddingVertical: 14, paddingHorizontal: 40,
    borderWidth: 1, borderColor: Colors.warning + '60', width: '100%',
  },
  extendBtnText: { color: Colors.warning, fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightBold },
  modalOverlay: { flex: 1, backgroundColor: '#00000090', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  modalTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalOptionText: { color: Colors.textPrimary, fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemibold },
  modalCancel: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.md, fontSize: Typography.fontSizeMD },
});
