import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  StatusBar,
  Vibration,
  Alert,
  TextInput,
  ScrollView,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as TaskManager from 'expo-task-manager';
import { sosAPI, aiAPI, contactsAPI, locationAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

const { width } = Dimensions.get('window');
const LOCATION_TASK_NAME = 'SOS_LOCATION_TRACKING';

type SOSPhase = 'idle' | 'countdown' | 'sending' | 'active';

export default function SOSScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { emitSOS } = useSocket();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Core State
  const [phase, setPhase] = useState<SOSPhase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>('Acquiring GPS location...');
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);

  // AI & Risk Data
  const [aiGuardianRisk, setAiGuardianRisk] = useState<{
    threat_level: string;
    risk_score: number;
    recommendation: string;
    risk_factors: string[];
  }>({
    threat_level: 'SAFE',
    risk_score: 15,
    recommendation: 'Continuous AI Guardian monitoring active.',
    risk_factors: ['No immediate threats detected'],
  });

  const [aiIntelResult, setAiIntelResult] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [nearbyServices, setNearbyServices] = useState<any[]>([]);

  // Features & States
  const [isRecording, setIsRecording] = useState(false);
  const [isHiddenMode, setIsHiddenMode] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const [capturedPhotosCount, setCapturedPhotosCount] = useState(0);
  const [isHoldingSOS, setIsHoldingSOS] = useState(false);

  // Refs & Animations
  const holdAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerTapRef = useRef(0);
  const countdownRef = useRef<any>(null);
  const sosLiveIntervalRef = useRef<any>(null);
  const photoIntervalRef = useRef<any>(null);
  const photoCountRef = useRef(0);

  // Camera & Audio
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Continuous Pulse Animation for SOS active / idle
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Initial Load & Listeners
  useEffect(() => {
    fetchLocationAndServices();
    fetchContacts();
    setupShakeDetection();

    if (!cameraPermission?.granted) {
      requestCameraPermission();
    }

    // Auto-trigger safety protocol if requested by navigation params
    const autoTrigger = route?.params?.autoTrigger;
    const triggerType = route?.params?.triggerType || 'button';

    if (autoTrigger) {
      if (user?.safety_preferences?.sos_auto_activation) {
        triggerSOS(triggerType);
      } else {
        startCountdown(triggerType);
      }
    }

    return () => {
      Accelerometer.removeAllListeners();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
      if (sosLiveIntervalRef.current) clearInterval(sosLiveIntervalRef.current);
    };
  }, [route?.params]);

  // Fetch Location, Reverse Geocode & Nearest Services
  const fetchLocationAndServices = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationAddress('Location permission denied');
        return;
      }

      let loc;
      try {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        loc = await Location.getLastKnownPositionAsync();
      }

      if (loc?.coords) {
        setLocation(loc.coords);
        const { latitude, longitude } = loc.coords;

        // Reverse Geocode
        try {
          const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocode.length > 0) {
            const g = geocode[0];
            const addr = [g.name, g.street, g.subregion || g.city, g.region].filter(Boolean).join(', ');
            setLocationAddress(addr || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          } else {
            setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch {
          setLocationAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }

        // Fetch AI Predictive Risk
        try {
          const riskRes = await aiAPI.predictiveGuardian({ latitude, longitude });
          if (riskRes.data?.success) {
            setAiGuardianRisk({
              threat_level: riskRes.data.threat_level || 'SAFE',
              risk_score: riskRes.data.risk_score || 15,
              recommendation: riskRes.data.recommendation || 'Continuous AI Guardian monitoring active.',
              risk_factors: riskRes.data.risk_factors || [],
            });
          }
        } catch {}

        // Fetch Nearest Emergency Services
        try {
          const servRes = await aiAPI.getNearbyServices(latitude, longitude);
          if (servRes.data?.services) {
            setNearbyServices(servRes.data.services.slice(0, 4));
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[SOSScreen] Location fetch failed:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await contactsAPI.getAll();
      if (res.data) setContacts(res.data);
    } catch (e) {
      console.warn('[SOSScreen] Fetch contacts failed:', e);
    }
  };

  // Shake Detection Logic
  const setupShakeDetection = () => {
    if (!user?.safety_preferences?.shake_detection) return;

    let lastShake = 0;
    let localCount = 0;
    const sensitivity = user?.safety_preferences?.shake_sensitivity || 2.8;

    Accelerometer.setUpdateInterval(100);
    Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > sensitivity && now - lastShake > 300) {
        lastShake = now;
        localCount++;
        setShakeCount(localCount);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (localCount >= 3) {
          localCount = 0;
          setShakeCount(0);
          if (user?.safety_preferences?.sos_auto_activation) {
            triggerSOS('shake');
          } else {
            startCountdown('shake');
          }
        }

        setTimeout(() => {
          if (Date.now() - lastShake > 1500) {
            localCount = 0;
            setShakeCount(0);
          }
        }, 1600);
      }
    });
  };

  // Countdown Timers
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
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPhase('idle');
    setCountdown(3);
    holdAnim.setValue(0);
    setIsHoldingSOS(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Hold-to-SOS Handlers
  const handlePressInSOS = () => {
    setIsHoldingSOS(true);
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        Vibration.vibrate([0, 500, 200, 500]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        triggerSOS('hold_to_sos');
      }
    });
  };

  const handlePressOutSOS = () => {
    if (phase === 'idle') {
      holdAnim.stopAnimation();
      holdAnim.setValue(0);
      setIsHoldingSOS(false);
    }
  };

  // Live Location Background Tracking
  const startLiveTracking = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5,
          foregroundService: {
            notificationTitle: 'SafeHer SOS Tracking Active',
            notificationBody: 'Broadcasting live location to emergency responders.',
            notificationColor: Colors.danger,
          },
        });
      }
    } catch (e) {
      console.warn('Background location failed', e);
    }

    if (sosLiveIntervalRef.current) clearInterval(sosLiveIntervalRef.current);
    sosLiveIntervalRef.current = setInterval(async () => {
      try {
        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
        if (!loc) return;
        setLocation(loc.coords);
        await locationAPI.sosLive({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          altitude: loc.coords.altitude,
        });
      } catch (err) {
        console.warn('SOS live location error:', err);
      }
    }, 6000);
  };

  // Audio Recording & Analysis
  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await new Promise((res) => setTimeout(res, 150));
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopAndUploadRecording = async () => {
    try {
      setIsRecording(false);
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'sos_audio.m4a';
        formData.append('audio', { uri, name: filename, type: 'audio/m4a' } as any);
        formData.append('user_id', user?.id || '');
        formData.append('latitude', location?.latitude?.toString() || '0');
        formData.append('longitude', location?.longitude?.toString() || '0');

        const res = await sosAPI.triggerWithVoice(formData);
        if (res.data?.intelligence) {
          setAiIntelResult(res.data.intelligence);
        }
      }
    } catch (err: any) {
      console.error('Audio upload failed:', err);
    }
  };

  // Silent Photo Capture Evidence
  const capturePhoto = async (alertId?: string) => {
    if (!cameraRef.current || photoCountRef.current >= 6) {
      if (photoCountRef.current >= 6 && photoIntervalRef.current) {
        clearInterval(photoIntervalRef.current);
      }
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo?.uri) return;
      photoCountRef.current += 1;
      setCapturedPhotosCount(photoCountRef.current);

      const formData = new FormData();
      const filename = photo.uri.split('/').pop() || `evidence_${Date.now()}.jpg`;
      formData.append('photo', { uri: photo.uri, name: filename, type: 'image/jpeg' } as any);
      formData.append('user_id', user?.id || '');
      formData.append('latitude', location?.latitude?.toString() || '0');
      formData.append('longitude', location?.longitude?.toString() || '0');
      if (alertId) formData.append('alert_id', alertId);

      await sosAPI.uploadPhotoEvidence(formData);
    } catch (err: any) {
      console.error('[SOS Evidence] Photo capture failed:', err);
    }
  };

  // Main Trigger SOS Logic
  const triggerSOS = async (trigger = 'button') => {
    setPhase('sending');
    holdAnim.setValue(0);
    setIsHoldingSOS(false);
    Vibration.vibrate([0, 500, 200, 500]);
    startLiveTracking();
    startRecording();

    try {
      const res = await sosAPI.trigger({
        user_id: user?.id || 'unknown',
        trigger_type: trigger,
        location: location
          ? { latitude: location.latitude, longitude: location.longitude }
          : { latitude: 0, longitude: 0 },
        message: message || (isHiddenMode ? 'SILENT SOS TRIGGERED' : 'Emergency SOS Alert Activated'),
      });

      const alertId = res.data?.alert?.id || '';
      setActiveAlertId(alertId);

      // Photo Evidence Capture Setup
      let hasCam = cameraPermission?.granted;
      if (!hasCam) {
        try {
          const perm = await requestCameraPermission();
          hasCam = perm?.granted;
        } catch (_) {}
      }

      if (hasCam) {
        photoCountRef.current = 0;
        setCapturedPhotosCount(0);
        setTimeout(() => {
          capturePhoto(alertId);
          if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
          photoIntervalRef.current = setInterval(() => {
            capturePhoto(alertId);
          }, 8000);
        }, 500);
      }

      // Socket Live Dispatch
      emitSOS(
        {
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
        },
        'high'
      );

      setPhase('active');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Stop Audio Recording after 6 seconds and run LLM voice analysis
      setTimeout(() => {
        stopAndUploadRecording();
      }, 6000);
    } catch (err: any) {
      console.error('SOS Trigger failed', err);
      const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
      if (!isHiddenMode && primaryContact?.phone) {
        Alert.alert(
          'Connection Alert',
          'Backend SOS endpoint reached connection timeout. Triggering direct emergency telephone call to primary contact.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call Now', onPress: () => Linking.openURL(`tel:${primaryContact.phone}`) },
          ]
        );
      }
      setPhase('active');
    }
  };

  // Voice SOS Instant Button
  const handleVoiceSOS = async () => {
    try {
      if (isRecording) {
        setIsRecording(false);
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) return;

        const formData = new FormData();
        const filename = uri.split('/').pop() || 'voice_sos.m4a';
        formData.append('audio', { uri, name: filename, type: 'audio/m4a' } as any);
        formData.append('user_id', user?.id || '');
        formData.append('latitude', location?.latitude?.toString() || '0');
        formData.append('longitude', location?.longitude?.toString() || '0');

        const res = await sosAPI.triggerWithVoice(formData);
        if (res.data?.intelligence) {
          setAiIntelResult(res.data.intelligence);
        }
        setPhase('active');
        startLiveTracking();
        Alert.alert('Voice SOS Processed', 'AI Voice analysis complete. Emergency alert active.');
      } else {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) return;
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
        setIsRecording(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } catch (err) {
      console.error('Voice SOS error', err);
      setIsRecording(false);
    }
  };

  // Resolve / I'm Safe Handler
  const handleResolveSOS = () => {
    Alert.alert(
      'Confirm Safety Status',
      'Are you safe now? Resolving SOS will notify your emergency contacts and terminate live emergency tracking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I AM SAFE',
          style: 'destructive',
          onPress: async () => {
            setPhase('idle');
            setMessage('');
            setAiIntelResult(null);
            setCapturedPhotosCount(0);

            if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
            if (sosLiveIntervalRef.current) clearInterval(sosLiveIntervalRef.current);

            try {
              if (activeAlertId) {
                await sosAPI.resolve(activeAlertId);
              } else {
                const activeAlerts = await sosAPI.getMyAlerts();
                if (activeAlerts.data?.length > 0) {
                  const latest = activeAlerts.data[0];
                  if (latest.status === 'active') {
                    await sosAPI.resolve(latest.id);
                  }
                }
              }
            } catch (e) {
              console.warn('Failed to resolve alert on backend:', e);
            }

            try {
              const active = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
              if (active) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            } catch (_) {}

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const getThreatColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL': return Colors.danger;
      case 'HIGH': return '#EF4444';
      case 'MEDIUM': return '#F59E0B';
      default: return '#10B981';
    }
  };

  const threatColor = getThreatColor(aiGuardianRisk.threat_level);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Hidden Camera for evidence capture */}
      {cameraPermission?.granted && (
        <View style={s.hiddenCamera}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mute />
        </View>
      )}

      {/* Header Bar */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

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
          style={s.headerTitleBox}
        >
          <Text style={s.headerTitle}>{isHiddenMode ? 'System Monitor' : 'Emergency SOS'}</Text>
          {phase === 'active' && (
            <View style={s.liveHeaderBadge}>
              <View style={s.pulseDot} />
              <Text style={s.liveHeaderText}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={s.headerRight}>
          <Ionicons
            name={location ? 'location' : 'location-outline'}
            size={20}
            color={location ? '#10B981' : '#64748B'}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Shake Banner Alert */}
        {shakeCount > 0 && !isHiddenMode && (
          <View style={s.shakeBanner}>
            <Ionicons name="phone-portrait" size={18} color="#F59E0B" />
            <Text style={s.shakeText}> Shake detected ({shakeCount}/3)... Triggering SOS soon!</Text>
          </View>
        )}

        {/* ━━ PRE-ACTIVATION / IDLE / COUNTDOWN SCREEN ━━━━ */}
        {phase !== 'active' && (
          <>
            {/* 1. AI RISK LEVEL CARD */}
            <View style={[s.card, { borderColor: threatColor + '40' }]}>
              <View style={s.cardHeader}>
                <View style={s.cardHeaderLeft}>
                  <Ionicons name="shield-checkmark" size={20} color={threatColor} />
                  <Text style={s.cardTitle}>AI Safety Guardian Assessment</Text>
                </View>
                <View style={[s.threatBadge, { backgroundColor: threatColor + '20' }]}>
                  <Text style={[s.threatBadgeText, { color: threatColor }]}>
                    {aiGuardianRisk.threat_level.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={s.riskScoreText}>
                Threat Index: <Text style={{ color: threatColor, fontWeight: '900' }}>{aiGuardianRisk.risk_score}%</Text>
              </Text>
              <Text style={s.recommendationText}>{aiGuardianRisk.recommendation}</Text>

              <View style={s.locationRow}>
                <Ionicons name="navigate-circle" size={16} color={Colors.primaryLight} />
                <Text style={s.locationAddressText} numberOfLines={1}>
                  {locationAddress}
                </Text>
              </View>
            </View>

            {/* 2. LARGE HOLD-TO-SOS BUTTON & COUNTDOWN */}
            <View style={s.sosCenter}>
              {phase === 'idle' && (
                <View style={s.sosButtonWrapper}>
                  {/* Progress Ring Overlay when Holding */}
                  {isHoldingSOS && (
                    <Animated.View
                      style={[
                        s.progressRing,
                        {
                          transform: [
                            {
                              scale: holdAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.25],
                              }),
                            },
                          ],
                          opacity: holdAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.4, 0.9],
                          }),
                        },
                      ]}
                    />
                  )}

                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Pressable
                      style={[
                        s.sosMainBtn,
                        isHoldingSOS && { backgroundColor: '#B91C1C', transform: [{ scale: 0.96 }] },
                      ]}
                      onPressIn={handlePressInSOS}
                      onPressOut={handlePressOutSOS}
                      onPress={() => startCountdown('button')}
                    >
                      <LottieView
                        source={{ uri: 'https://lottie.host/808b3e83-366b-4e00-84c4-77e82f8a846c/2jZ5J8Yf9O.json' }}
                        autoPlay
                        loop
                        style={s.sosLottie}
                      />
                      <View style={s.sosInnerContent}>
                        <Ionicons name="alert-circle" size={42} color="#fff" />
                        <Text style={s.sosMainText}>SOS</Text>
                        <Text style={s.sosHoldSubtext}>
                          {isHoldingSOS ? 'HOLDING FOR EMERGENCY...' : 'HOLD 2S OR TAP'}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                </View>
              )}

              {phase === 'countdown' && (
                <View style={s.countdownBox}>
                  <Text style={s.countdownNum}>{countdown}</Text>
                  <Text style={s.countdownLabel}>BROADCASTING EMERGENCY ALERT</Text>
                  <TouchableOpacity style={s.cancelBtn} onPress={cancelCountdown}>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={s.cancelText}>CANCEL SOS</Text>
                  </TouchableOpacity>
                </View>
              )}

              {phase === 'sending' && (
                <View style={s.sendingBox}>
                  <LottieView
                    source={{ uri: 'https://lottie.host/808b3e83-366b-4e00-84c4-77e82f8a846c/2jZ5J8Yf9O.json' }}
                    autoPlay
                    loop
                    style={{ width: 140, height: 140 }}
                  />
                  <Text style={s.sendingText}>DISPATCHING TWILIO CALLS & SMS...</Text>
                </View>
              )}
            </View>

            {/* 3. VOICE SOS & QUICK ACTIONS */}
            <View style={s.quickActionsRow}>
              <TouchableOpacity
                style={[s.actionCard, isRecording && s.actionCardActive]}
                onPress={handleVoiceSOS}
              >
                <View style={[s.actionIconBox, isRecording && { backgroundColor: Colors.danger }]}>
                  <Ionicons name={isRecording ? 'stop-circle' : 'mic'} size={24} color="#fff" />
                </View>
                <View style={s.actionTextGroup}>
                  <Text style={[s.actionTitle, isRecording && { color: Colors.danger }]}>
                    {isRecording ? 'Listening...' : 'Voice SOS'}
                  </Text>
                  <Text style={s.actionSub}>
                    {isRecording ? 'Analyzing audio...' : 'Hands-free AI voice'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionCard}
                onPress={() => Linking.openURL('tel:112')}
              >
                <View style={[s.actionIconBox, { backgroundColor: '#2563EB' }]}>
                  <Ionicons name="call" size={24} color="#fff" />
                </View>
                <View style={s.actionTextGroup}>
                  <Text style={s.actionTitle}>Call 112 / Police</Text>
                  <Text style={s.actionSub}>Direct Police Line</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Optional Distress Message */}
            <View style={s.messageCard}>
              <TextInput
                style={s.messageInput}
                placeholder="Optional emergency notes / situation details..."
                placeholderTextColor="#64748B"
                value={message}
                onChangeText={setMessage}
                multiline
              />
            </View>

            {/* 4. EMERGENCY CONTACTS LIST */}
            {contacts.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="people" size={18} color={Colors.primaryLight} />
                  <Text style={s.sectionTitle}>Emergency Contacts ({contacts.length})</Text>
                </View>

                {contacts.slice(0, 3).map((item, idx) => (
                  <View key={item.id || idx.toString()} style={s.contactRow}>
                    <View style={s.contactAvatar}>
                      <Text style={s.contactAvatarText}>{item.name?.[0]?.toUpperCase() || 'C'}</Text>
                    </View>
                    <View style={s.contactInfo}>
                      <View style={s.contactNameRow}>
                        <Text style={s.contactName}>{item.name}</Text>
                        {item.is_primary && (
                          <View style={s.primaryBadge}>
                            <Text style={s.primaryBadgeText}>PRIMARY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.contactPhone}>{item.phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={s.contactCallBtn}
                      onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    >
                      <Ionicons name="call" size={18} color="#10B981" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 5. NEAREST EMERGENCY SERVICES */}
            {nearbyServices.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="business" size={18} color="#8B5CF6" />
                  <Text style={s.sectionTitle}>Nearest Safe Havens & Services</Text>
                </View>

                {nearbyServices.map((serv, idx) => (
                  <View key={idx.toString()} style={s.serviceCard}>
                    <View style={s.serviceLeft}>
                      <View
                        style={[
                          s.serviceIcon,
                          {
                            backgroundColor:
                              serv.type === 'police' ? '#1E3A8A' : serv.type === 'hospital' ? '#991B1B' : '#374151',
                          },
                        ]}
                      >
                        <Ionicons
                          name={serv.type === 'police' ? 'shield-sharp' : 'medical'}
                          size={18}
                          color="#fff"
                        />
                      </View>
                      <View style={s.serviceTextGroup}>
                        <Text style={s.serviceName} numberOfLines={1}>
                          {serv.name}
                        </Text>
                        <Text style={s.serviceAddress} numberOfLines={1}>
                          {serv.address || serv.type?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={s.serviceRight}>
                      <Text style={s.serviceDist}>{serv.distance ? `${serv.distance} km` : 'Nearby'}</Text>
                      {serv.phone && (
                        <TouchableOpacity
                          style={s.serviceCallIcon}
                          onPress={() => Linking.openURL(`tel:${serv.phone}`)}
                        >
                          <Ionicons name="call" size={16} color="#10B981" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ━━ AFTER ACTIVATION: SOS ACTIVE VIEW ━━━━ */}
        {phase === 'active' && (
          <>
            {/* ACTIVE BANNER */}
            <View style={s.activeBanner}>
              <Animated.View style={[s.activeBannerPulse, { opacity: pulseAnim.interpolate({ inputRange: [1, 1.08], outputRange: [0.7, 1] }) }]} />
              <Ionicons name="warning" size={28} color="#fff" />
              <View>
                <Text style={s.activeBannerTitle}>🚨 SOS ALERT ACTIVE</Text>
                <Text style={s.activeBannerSub}>Live GPS tracking & emergency dispatch active</Text>
              </View>
            </View>

            {/* LIVE MINI MAP */}
            {location && (
              <View style={s.mapContainer}>
                <MapView
                  style={s.miniMap}
                  initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  showsUserLocation
                  showsMyLocationButton={false}
                >
                  <UrlTile
                    urlTemplate="https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
                    maximumZ={19}
                    flipY={false}
                    tileSize={256}
                  />
                  <Marker
                    coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                    title="Your Location"
                    description="SOS Active Location"
                  >
                    <View style={s.userMarkerOuter}>
                      <View style={s.userMarkerInner} />
                    </View>
                  </Marker>

                  {nearbyServices.map((serv, idx) => (
                    <Marker
                      key={idx.toString()}
                      coordinate={{
                        latitude: serv.latitude || location.latitude + 0.002 * (idx + 1),
                        longitude: serv.longitude || location.longitude + 0.002 * (idx + 1),
                      }}
                      title={serv.name}
                      description={serv.type}
                    >
                      <View style={[s.havenMarker, { backgroundColor: serv.type === 'police' ? '#1E40AF' : '#DC2626' }]}>
                        <Ionicons name={serv.type === 'police' ? 'shield' : 'medical'} size={14} color="#fff" />
                      </View>
                    </Marker>
                  ))}
                </MapView>

                <View style={s.mapOverlayBadge}>
                  <Ionicons name="location" size={14} color="#10B981" />
                  <Text style={s.mapOverlayText} numberOfLines={1}>
                    {locationAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* AI EMERGENCY INTELLIGENCE CARD */}
            <View style={s.intelCard}>
              <View style={s.intelCardHeader}>
                <Ionicons name="sparkles" size={20} color={Colors.primaryLight} />
                <Text style={s.intelCardTitle}>AI Emergency Intelligence</Text>
              </View>

              <View style={s.intelRow}>
                <Text style={s.intelLabel}>THREAT LEVEL</Text>
                <View style={[s.intelBadge, { backgroundColor: threatColor + '20' }]}>
                  <Text style={[s.intelBadgeText, { color: threatColor }]}>
                    {(aiIntelResult?.danger_level || aiGuardianRisk.threat_level || 'CRITICAL').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={s.intelRow}>
                <Text style={s.intelLabel}>SOS TRIGGER</Text>
                <Text style={s.intelVal}>{(route?.params?.triggerType || 'Hold-to-SOS').toUpperCase()}</Text>
              </View>

              {aiIntelResult && (
                <View style={s.intelRow}>
                  <Text style={s.intelLabel}>VOICE / STRESS ANALYSIS</Text>
                  <Text style={s.intelVal}>
                    {aiIntelResult.stress_level
                      ? `${(aiIntelResult.stress_level * 100).toFixed(0)}% Stress Level`
                      : aiIntelResult.emotion || 'Distress signal confirmed'}
                  </Text>
                </View>
              )}

              <View style={s.intelAdviceBox}>
                <Ionicons name="bulb" size={16} color={Colors.primaryLight} />
                <Text style={s.intelAdviceText}>
                  {aiIntelResult?.summary ||
                    aiGuardianRisk.recommendation ||
                    'Keep phone accessible. Move toward well-lit public area or police station immediately.'}
                </Text>
              </View>
            </View>

            {/* EVIDENCE STATUS CARD */}
            <View style={s.evidenceCard}>
              <Text style={s.evidenceTitle}>Real-Time Evidence & Dispatch Status</Text>

              <View style={s.evidenceRow}>
                <Ionicons name="mic" size={18} color={isRecording ? Colors.danger : '#10B981'} />
                <Text style={s.evidenceText}>
                  {isRecording ? 'Emergency Audio Stream Active...' : 'Audio Evidence Uploaded to Cloud'}
                </Text>
              </View>

              <View style={s.evidenceRow}>
                <Ionicons name="camera" size={18} color="#8B5CF6" />
                <Text style={s.evidenceText}>
                  Silent Camera Evidence Snapshots: <Text style={{ fontWeight: '900', color: '#fff' }}>{capturedPhotosCount} Captured</Text>
                </Text>
              </View>

              <View style={s.evidenceRow}>
                <Ionicons name="radio" size={18} color="#10B981" />
                <Text style={s.evidenceText}>Socket.IO Admin Dashboard Dispatch Active</Text>
              </View>
            </View>

            {/* SOS STATUS TIMELINE */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>SOS Response Timeline</Text>
              <View style={s.timeline}>
                <View style={s.timelineStep}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={s.timelineText}>1. GPS High-Accuracy Location Acquired</Text>
                </View>
                <View style={s.timelineStep}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={s.timelineText}>2. AI Predictive Threat Assessed</Text>
                </View>
                <View style={s.timelineStep}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={s.timelineText}>3. Twilio SMS & Calls Broadcasted</Text>
                </View>
                <View style={s.timelineStep}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={s.timelineText}>4. Background Live Tracking Active</Text>
                </View>
                <View style={s.timelineStep}>
                  <Ionicons name="sync-circle" size={20} color={Colors.primaryLight} />
                  <Text style={s.timelineText}>5. Continuous Audio & Photo Evidence Collection</Text>
                </View>
              </View>
            </View>

            {/* PROMINENT RESOLVE / I'M SAFE BUTTON */}
            <TouchableOpacity style={s.resolveBtn} onPress={handleResolveSOS}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
              <Text style={s.resolveBtnText}>I'M SAFE / RESOLVE SOS</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ━━ STYLES ━━━━
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  hiddenCamera: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    opacity: 0.01,
    zIndex: -1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: Spacing.md,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
  },
  liveHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.danger + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.danger + '60',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
  liveHeaderText: {
    color: Colors.danger,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerRight: {
    padding: 6,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  shakeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B20',
    borderWidth: 1,
    borderColor: '#F59E0B60',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  shakeText: {
    color: '#F59E0B',
    fontSize: Typography.fontSizeSM,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
  },
  threatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  threatBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  riskScoreText: {
    fontSize: Typography.fontSizeSM,
    color: '#94a3b8',
    marginBottom: 6,
  },
  recommendationText: {
    fontSize: Typography.fontSizeSM,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  locationAddressText: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },

  // SOS BUTTON CENTER
  sosCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.xl,
  },
  sosButtonWrapper: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 6,
    borderColor: '#DC2626',
    backgroundColor: '#DC262620',
  },
  sosMainBtn: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  sosLottie: {
    position: 'absolute',
    width: 290,
    height: 290,
  },
  sosInnerContent: {
    alignItems: 'center',
    zIndex: 5,
  },
  sosMainText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    marginTop: -4,
  },
  sosHoldSubtext: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  countdownBox: {
    alignItems: 'center',
    gap: 12,
  },
  countdownNum: {
    fontSize: 110,
    fontWeight: '900',
    color: Colors.danger,
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.full,
    marginTop: 16,
  },
  cancelText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  sendingBox: {
    alignItems: 'center',
    gap: 16,
  },
  sendingText: {
    color: Colors.danger,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // QUICK ACTIONS
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionCardActive: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger + '10',
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextGroup: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  actionSub: {
    fontSize: 11,
    color: '#94a3b8',
  },

  messageCard: {
    backgroundColor: '#1e293b',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: Spacing.lg,
  },
  messageInput: {
    fontSize: 13,
    color: '#fff',
    minHeight: 50,
    textAlignVertical: 'top',
  },

  // SECTIONS
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
    color: '#fff',
  },

  // CONTACTS
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: '#334155',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: Colors.primaryLight,
    fontWeight: '800',
    fontSize: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  primaryBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  primaryBadgeText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
  },
  contactPhone: {
    fontSize: 12,
    color: '#94a3b8',
  },
  contactCallBtn: {
    padding: 10,
    backgroundColor: '#10B98115',
    borderRadius: BorderRadius.full,
  },

  // SERVICES
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: '#334155',
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceTextGroup: {
    flex: 1,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  serviceAddress: {
    fontSize: 11,
    color: '#94a3b8',
  },
  serviceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  serviceDist: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  serviceCallIcon: {
    padding: 8,
    backgroundColor: '#10B98115',
    borderRadius: BorderRadius.full,
  },

  // SOS ACTIVE VIEW STYLES
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.danger,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  activeBannerPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#991B1B',
  },
  activeBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  activeBannerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },

  mapContainer: {
    height: 180,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '60',
  },
  miniMap: {
    flex: 1,
  },
  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.danger + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.danger,
  },
  havenMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  mapOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172ae0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  mapOverlayText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },

  // INTEL CARD
  intelCard: {
    backgroundColor: '#1e293b',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '40',
    marginBottom: Spacing.lg,
  },
  intelCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  intelCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  intelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#33415550',
  },
  intelLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '800',
  },
  intelVal: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  intelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  intelBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  intelAdviceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primary + '15',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  intelAdviceText: {
    flex: 1,
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    fontWeight: '600',
  },

  // EVIDENCE CARD
  evidenceCard: {
    backgroundColor: '#1e293b',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: Spacing.lg,
  },
  evidenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    marginBottom: Spacing.md,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  evidenceText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // TIMELINE
  timeline: {
    gap: 12,
    marginTop: Spacing.xs,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timelineText: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },

  // RESOLVE BUTTON
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    ...Shadows.card,
  },
  resolveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

// Expo Background Location Tracking Task Definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    if (locations?.[0]?.coords) {
      console.log('Background Location Tracking:', locations[0].coords);
    }
  }
});
