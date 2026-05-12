import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Vibration } from 'react-native';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/theme';

interface SOSButtonProps {
  onPress: () => void;
  onLongPress: () => void;
}

export default function SOSButton({ onPress, onLongPress }: SOSButtonProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(1)).current;
  const ripple2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const createRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 2.2, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        ])
      ).start();

    createRipple(ripple1, 0);
    createRipple(ripple2, 1000);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ripple, { transform: [{ scale: ripple1 }], opacity: ripple1.interpolate({ inputRange: [1, 2.2], outputRange: [0.5, 0] }) }]} />
      <Animated.View style={[styles.ripple, { transform: [{ scale: ripple2 }], opacity: ripple2.interpolate({ inputRange: [1, 2.2], outputRange: [0.5, 0] }) }]} />
      
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
          }}
          onLongPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate(500);
            onLongPress();
          }}
        >
          <LottieView
            source={{ uri: 'https://lottie.host/808b3e83-366b-4e00-84c4-77e82f8a846c/2jZ5J8Yf9O.json' }} // Modern emergency ring pulse
            autoPlay
            loop
            style={styles.lottie}
          />
          <View style={styles.content}>
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.subText}>HOLD FOR SILENT</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 220, height: 220, justifyContent: 'center', alignItems: 'center' },
  ripple: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.danger, opacity: 0.3,
  },
  button: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.danger, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.danger, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 15,
  },
  lottie: { position: 'absolute', width: 280, height: 280 },
  content: { alignItems: 'center', zIndex: 5 },
  sosText: { color: Colors.white, fontSize: 48, fontWeight: '900', letterSpacing: 2 },
  subText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginTop: 4 },
});
