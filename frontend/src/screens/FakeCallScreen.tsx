import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar, Vibration, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const FAKE_CONTACTS = ['Mom 💜', 'Sister 👧', 'Best Friend 😊', 'Dad 🛡️'];

export default function FakeCallScreen({ navigation }: any) {
  const [phase, setPhase] = useState<'ringing' | 'active'>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const [callerName] = useState(FAKE_CONTACTS[Math.floor(Math.random() * FAKE_CONTACTS.length)]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const avatarPulse = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    // Start entrance animation
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Pulsing avatar
    Animated.loop(
      Animated.sequence([
        Animated.timing(avatarPulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(avatarPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Vibrate like a real phone ringing
    const vibePattern = [0, 600, 400, 600, 400, 600];
    const vibeInterval = setInterval(() => Vibration.vibrate(vibePattern), 2500);

    return () => {
      clearInterval(vibeInterval);
      clearInterval(timerRef.current);
      Vibration.cancel();
    };
  }, []);

  const handleAnswer = () => {
    Vibration.cancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('active');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const handleDecline = () => {
    Vibration.cancel();
    navigation.goBack();
  };

  const handleHangUp = () => {
    clearInterval(timerRef.current);
    Vibration.cancel();
    navigation.goBack();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Caller Info */}
      <View style={styles.callerSection}>
        <Text style={styles.callStatus}>
          {phase === 'ringing' ? '📞 Incoming Call...' : `🔴 ${formatTime(elapsed)}`}
        </Text>

        <Animated.View style={[styles.avatarRing, { transform: [{ scale: avatarPulse }] }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>👩</Text>
          </View>
        </Animated.View>

        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callerSub}>Mobile · India</Text>

        {phase === 'ringing' && (
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
              <Text style={styles.tagText}> SafeHer Decoy Call</Text>
            </View>
          </View>
        )}
      </View>

      {/* Active Call UI */}
      {phase === 'active' && (
        <View style={styles.activeRow}>
          {[
            { icon: 'mic-off', label: 'Mute' },
            { icon: 'keypad', label: 'Keypad' },
            { icon: 'volume-high', label: 'Speaker' },
          ].map((btn) => (
            <TouchableOpacity key={btn.label} style={styles.callControl}>
              <View style={styles.callControlIcon}>
                <Ionicons name={btn.icon as any} size={22} color={Colors.textPrimary} />
              </View>
              <Text style={styles.callControlLabel}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        {phase === 'ringing' ? (
          <>
            <View style={styles.actionCol}>
              <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline}>
                <Ionicons name="call" size={32} color={Colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Decline</Text>
            </View>
            <View style={styles.actionCol}>
              <TouchableOpacity style={[styles.actionBtn, styles.answerBtn]} onPress={handleAnswer}>
                <Ionicons name="call" size={32} color={Colors.white} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Answer</Text>
            </View>
          </>
        ) : (
          <View style={styles.actionCol}>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleHangUp}>
              <Ionicons name="call" size={32} color={Colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>End Call</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 60,
  },
  callerSection: { alignItems: 'center', gap: 16 },
  callStatus: {
    fontSize: Typography.fontSizeMD, color: Colors.textSecondary,
    fontWeight: Typography.fontWeightMedium, letterSpacing: 0.5,
  },
  avatarRing: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 3, borderColor: Colors.success + '60',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.success + '15',
    marginVertical: 10,
  },
  avatar: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 64 },
  callerName: {
    fontSize: 32, fontWeight: Typography.fontWeightExtrabold,
    color: Colors.textPrimary, textAlign: 'center',
  },
  callerSub: { fontSize: Typography.fontSizeMD, color: Colors.textMuted },
  tagRow: { flexDirection: 'row' },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.success + '20', paddingHorizontal: 12,
    paddingVertical: 4, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.success + '40',
  },
  tagText: { fontSize: Typography.fontSizeSM, color: Colors.success, fontWeight: Typography.fontWeightSemibold },
  activeRow: {
    flexDirection: 'row', gap: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  callControl: { alignItems: 'center', gap: 8 },
  callControlIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#ffffff15', justifyContent: 'center', alignItems: 'center',
  },
  callControlLabel: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary },
  actionRow: {
    flexDirection: 'row', gap: 80,
    paddingBottom: 20,
  },
  actionCol: { alignItems: 'center', gap: 12 },
  actionBtn: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
  },
  declineBtn: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  answerBtn: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  actionLabel: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, fontWeight: Typography.fontWeightMedium },
});
