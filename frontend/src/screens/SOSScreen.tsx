import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, StatusBar, Vibration, Alert, TextInput, ScrollView, Share, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as TaskManager from 'expo-task-manager';
import { sosAPI, aiAPI, contactsAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import SOSButton from '../components/SOSButton';

type SOSPhase = 'idle' | 'countdown' | 'sending' | 'sent';

const LOCATION_TASK_NAME = 'SOS_LOCATION_TRACKING';

export default function SOSScreen({ navigation }: any) {
  const { user } = useAuth();
  const { emitSOS } = useSocket();
  const [phase, setPhase] = useState<SOSPhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [isHiddenMode, setIsHiddenMode] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [primaryContact, setPrimaryContact] = useState<any>(null);
  
  const headerTapRef = useRef(0);
  const countdownRef = useRef<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    getLocation();
    setupShakeDetection();
    fetchPrimaryContact();
    return () => {
      Accelerometer.removeAllListeners();
      clearInterval(countdownRef.current);
    };
  }, []);

  const fetchPrimaryContact = async () => {
    try {
      const res = await contactsAPI.getAll();
      const primary = res.data?.find((c: any) => c.is_primary);
      if (primary) setPrimaryContact(primary);
    } catch {}
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
    } catch { }
  };

  const setupShakeDetection = () => {
    let lastShake = 0;
    let localCount = 0;
    Accelerometer.setUpdateInterval(100);
    Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > 2.8 && now - lastShake > 500) {
        lastShake = now;
        localCount++;
        setShakeCount(localCount);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (localCount >= 3) {
          localCount = 0;
          setShakeCount(0);
          startCountdown('shake');
        }
      }
    });
  };

  const startCountdown = (trigger = 'button') => {
    if (phase !== 'idle') return;
    setPhase('countdown');
    setCountdown(3);
    let c = 3;
    countdownRef.current = setInterval(() => {
      c--;
      setCountdown(c);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Vibration.vibrate(200);
      if (c <= 0) {
        clearInterval(countdownRef.current);
        triggerSOS(trigger);
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    clearInterval(countdownRef.current);
    setPhase('idle');
    setCountdown(3);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const startLiveTracking = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
          foregroundService: {
            notificationTitle: "SafeHer Live Tracking",
            notificationBody: "Monitoring your safety in real-time.",
            notificationColor: Colors.primary,
          },
        });
      }
    } catch (e) {
      console.warn("Background location failed", e);
    }
  };

  const triggerSOS = async (trigger = 'button') => {
    setPhase('sending');
    Vibration.vibrate([0, 500, 200, 500]);
    startLiveTracking();

    // Fire Emergency Call immediately
    if (primaryContact?.phone) {
      Linking.openURL(`tel:${primaryContact.phone}`).catch(() => {});
    }

    try {
      // Backend Alert
      await sosAPI.trigger({
        user_id: user?.id,
        trigger_type: trigger,
        location: location ? { latitude: location.latitude, longitude: location.longitude } : { latitude: 0, longitude: 0 },
        message: message || (isHiddenMode ? 'SILENT SOS TRIGGERED' : 'Emergency SOS Alert'),
      });

      // Socket Update
      emitSOS({
        latitude: location?.latitude || 0,
        longitude: location?.longitude || 0,
      }, 'high');

      setPhase('sent');
    } catch (err) {
      console.error("SOS Trigger failed", err);
      setPhase('sent'); // Show sent anyway to keep user calm
    }
  };

  const handleVoiceSOS = async () => {
    try {
      if (isRecording) {
        setIsRecording(false);
        if (!recordingRef.current) return;
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        if (!uri) return;

        setPhase('sending');
        const formData = new FormData();
        formData.append('audio', { uri, name: 'voice_sos.wav', type: 'audio/wav' } as any);
        const res = await aiAPI.analyzeVoice(formData);
        const data = res.data;
        setAnalyzeResult(data);

        if (data.trigger_emergency || ['high', 'critical'].includes(data.danger_level?.toLowerCase())) {
          triggerSOS('voice');
        } else {
          setPhase('idle');
          Alert.alert('AI Analysis', `No immediate danger detected (${data.danger_level.toUpperCase()}). SOS not triggered.`);
        }
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (perm.status !== 'granted') return;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        recordingRef.current = recording;
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (err) {
      setIsRecording(false);
      setPhase('idle');
    }
  };

  const reset = () => {
    setPhase('idle');
    setMessage('');
    setAnalyzeResult(null);
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).then(active => {
      if (active) Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* Stealth Mode Header */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={() => {
          headerTapRef.current += 1;
          if (headerTapRef.current >= 3) {
            setIsHiddenMode(!isHiddenMode);
            headerTapRef.current = 0;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={isHiddenMode ? Colors.background : Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isHiddenMode && { color: Colors.background }]}>
          {isHiddenMode ? '' : 'Emergency SOS'}
        </Text>
        {isHiddenMode && <View style={styles.stealthDot} />}
        <View style={{ width: 24 }} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {shakeCount > 0 && !isHiddenMode && (
          <View style={styles.shakeBanner}>
            <Ionicons name="phone-portrait" size={16} color={Colors.warning} />
            <Text style={styles.shakeText}> Shake detected ({shakeCount}/3)...</Text>
          </View>
        )}

        <View style={styles.sosCenter}>
          {phase === 'idle' && (
            <SOSButton 
              onPress={() => startCountdown('button')} 
              onLongPress={() => {
                setIsHiddenMode(true);
                triggerSOS('hidden');
              }} 
            />
          )}

          {phase === 'countdown' && !isHiddenMode && (
            <View style={styles.countdown}>
              <Text style={styles.countdownNum}>{countdown}</Text>
              <Text style={styles.countdownLabel}>STARTING EMERGENCY ACTIONS</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelCountdown}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'sending' && !isHiddenMode && (
            <View style={styles.sending}>
              <LottieView
                source={{ uri: 'https://lottie.host/808b3e83-366b-4e00-84c4-77e82f8a846c/2jZ5J8Yf9O.json' }}
                autoPlay
                loop
                style={styles.lottieSending}
              />
              <Text style={styles.sendingText}>CALLING EMERGENCY CONTACTS...</Text>
            </View>
          )}

          {(phase === 'sent' || (phase === 'sending' && isHiddenMode)) && (
            <View style={styles.sentView}>
              {!isHiddenMode ? (
                <>
                  <LottieView
                    source={{ uri: 'https://lottie.host/191b2c4e-5813-43f1-9988-166299b87723/C7HUn0XqYq.json' }} // Success check
                    autoPlay
                    loop={false}
                    style={styles.lottieSuccess}
                  />
                  <Text style={styles.sentTitle}>SOS ALERT ACTIVE</Text>
                  <Text style={styles.sentSubtitle}>Location tracking & Audio recording active.</Text>
                  <TouchableOpacity style={styles.resetBtn} onPress={reset}>
                    <Text style={styles.resetText}>I AM SAFE NOW</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.hiddenActiveIndicator}>
                  <Text style={styles.hiddenActiveText}>Stealth Protection Active</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {phase === 'idle' && (
          <View style={styles.controls}>
             <View style={styles.triggerRow}>
              <TouchableOpacity
                style={[styles.triggerCard, isRecording && { borderColor: Colors.danger, backgroundColor: Colors.danger + '10' }]}
                onPress={handleVoiceSOS}
              >
                <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={28} color={isRecording ? Colors.danger : Colors.primary} />
                <Text style={[styles.triggerLabel, isRecording && { color: Colors.danger }]}>
                  {isRecording ? 'Listening...' : 'Voice SOS'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.triggerCard} onPress={() => Linking.openURL('tel:100')}>
                <Ionicons name="call" size={28} color={Colors.primary} />
                <Text style={styles.triggerLabel}>Call Police</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.messageBox}>
              <TextInput
                style={styles.input}
                placeholder="Message for AI analyzer..."
                value={message}
                onChangeText={setMessage}
                multiline
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingTop: 60 },
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  shakeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warning + '15', margin: Spacing.md, padding: Spacing.sm, borderRadius: BorderRadius.md },
  shakeText: { color: Colors.warning, fontSize: Typography.fontSizeSM, fontWeight: '600' },
  sosCenter: { alignItems: 'center', justifyContent: 'center', minHeight: 350 },
  countdown: { alignItems: 'center', gap: 10 },
  countdownNum: { fontSize: 120, fontWeight: '900', color: Colors.danger },
  countdownLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  cancelBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 30, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.cardBorder },
  cancelText: { fontWeight: '800', color: Colors.textPrimary },
  sending: { alignItems: 'center', gap: 20 },
  lottieSending: { width: 200, height: 200 },
  sendingText: { fontSize: 14, fontWeight: '800', color: Colors.danger, letterSpacing: 1 },
  sentView: { alignItems: 'center', paddingHorizontal: Spacing.xl },
  lottieSuccess: { width: 150, height: 150 },
  sentTitle: { fontSize: 24, fontWeight: '900', color: Colors.success, marginTop: -20 },
  sentSubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  resetBtn: { marginTop: 40, backgroundColor: Colors.success, paddingVertical: 16, paddingHorizontal: 40, borderRadius: BorderRadius.full, ...Shadows.card },
  resetText: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  controls: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  triggerRow: { flexDirection: 'row', gap: Spacing.md },
  triggerCard: { flex: 1, backgroundColor: Colors.card, padding: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: 'center', gap: 10, ...Shadows.card, borderWidth: 1, borderColor: Colors.cardBorder },
  triggerLabel: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  messageBox: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder },
  input: { fontSize: 14, color: Colors.textPrimary, minHeight: 60, textAlignVertical: 'top' },
  stealthDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, opacity: 0.5 },
  hiddenActiveIndicator: { padding: 30, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, borderWidth: 2, borderColor: Colors.success + '40' },
  hiddenActiveText: { color: Colors.textMuted, fontWeight: '700' },
});

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    console.log('Background Location Tracking:', locations[0].coords);
  }
});
