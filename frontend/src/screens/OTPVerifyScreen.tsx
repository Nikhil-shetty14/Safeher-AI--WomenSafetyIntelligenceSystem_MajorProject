import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, TouchableOpacity, TextInput, ActivityIndicator,
  Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

export default function OTPVerifyScreen({ route, navigation }: any) {
  const { session_id, phone, action } = route.params || {};
  const { verifyOTP, resendOTP } = useAuth();
  
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(session_id);
  
  // Timer state for resend cooldown (60 seconds)
  const [countdown, setCountdown] = useState(60);
  const [resendsCount, setResendsCount] = useState(0);
  
  // Attempts left counter (starts at 3)
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  
  const inputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // Auto focus the input field on load
    setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async (otpCode = code) => {
    if (otpCode.length !== 6) {
      shake();
      Alert.alert('Incomplete Code', 'Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOTP(currentSessionId, otpCode);
      // Auth state will update and automatically transition the user to Main authenticated stack.
    } catch (err: any) {
      shake();
      const errorMsg = err?.response?.data?.detail || 'Invalid verification code.';
      
      // Update attempts remaining if specified by backend
      if (errorMsg.includes('attempts remaining')) {
        const match = errorMsg.match(/(\d+) attempts remaining/);
        if (match) {
          setAttemptsLeft(parseInt(match[1]));
        } else {
          setAttemptsLeft((prev) => Math.max(0, prev - 1));
        }
        Alert.alert('Verification Failed', errorMsg);
      } else if (errorMsg.includes('blocked') || errorMsg.includes('expired')) {
        setAttemptsLeft(0);
        Alert.alert(
          'Session Expired/Blocked',
          'Too many incorrect attempts or session expired. Please return and request a new code.',
          [{ text: 'Go Back', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Verification Error', errorMsg);
      }
      
      // Clear code input on error to let user re-try easily
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    if (resendsCount >= 3) {
      Alert.alert('Limit Reached', 'Maximum resend attempts reached. Please go back and restart the flow.');
      return;
    }

    setResending(true);
    try {
      const res = await resendOTP(currentSessionId);
      Alert.alert('Success', 'A new verification code has been sent to your phone number.');
      setCountdown(60);
      setResendsCount((prev) => prev + 1);
      setAttemptsLeft(3); // Reset validation attempts
      setCode('');
      inputRef.current?.focus();
    } catch (err: any) {
      Alert.alert('Resend Failed', err?.response?.data?.detail || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleTextChange = (text: string) => {
    // Only allow digits and cap length at 6
    const cleanText = text.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(cleanText);
    if (cleanText.length === 6) {
      // Trigger verify automatically when 6th digit is typed
      handleVerify(cleanText);
    }
  };

  // Render individual digit boxes
  const renderCodeBoxes = () => {
    const boxes = [];
    for (let i = 0; i < 6; i++) {
      const char = code[i] || '';
      const isFocused = i === code.length;
      boxes.push(
        <View
          key={i}
          style={[
            styles.codeBox,
            isFocused && styles.codeBoxFocused,
            char !== '' && styles.codeBoxFilled,
          ]}
        >
          <Text style={styles.codeText}>{char}</Text>
        </View>
      );
    }
    return boxes;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
          
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            <Text style={styles.backText}>  Cancel</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.white} />
            </View>
            <Text style={styles.heading}>Security Verification</Text>
            <Text style={styles.subheading}>
              We sent a 6-digit OTP to your registered phone number ending in <Text style={styles.phoneHighlight}>{phone}</Text>
            </Text>
          </View>

          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.label}>Enter 6-Digit Code</Text>
            
            {/* Hidden Input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              value={code}
              onChangeText={handleTextChange}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
              autoFocus
            />

            {/* Visual Input Fields */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.codeBoxesContainer}
            >
              {renderCodeBoxes()}
            </TouchableOpacity>

            {/* Verification status and errors */}
            <View style={styles.statusRow}>
              {attemptsLeft < 3 && attemptsLeft > 0 && (
                <Text style={styles.warningText}>
                  ⚠️ {attemptsLeft} attempts remaining before lock
                </Text>
              )}
              {attemptsLeft === 0 && (
                <Text style={styles.errorText}>
                  ❌ Verification session locked. Please go back.
                </Text>
              )}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.verifyBtn,
                (code.length !== 6 || loading || attemptsLeft === 0) && styles.verifyBtnDisabled,
              ]}
              onPress={() => handleVerify()}
              disabled={code.length !== 6 || loading || attemptsLeft === 0}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-shield" size={20} color={Colors.white} />
                  <Text style={styles.verifyBtnText}>  Verify & Login</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend Cooldown UI */}
            <View style={styles.resendContainer}>
              {countdown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend code in <Text style={styles.timerText}>{countdown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resending || resendsCount >= 3}
                  style={styles.resendBtn}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={Colors.primaryLight} />
                  ) : (
                    <Text
                      style={[
                        styles.resendBtnText,
                        resendsCount >= 3 && styles.resendBtnTextDisabled,
                      ]}
                    >
                      {resendsCount >= 3 ? 'Resends Blocked' : 'Resend Verification Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              {resendsCount > 0 && resendsCount < 3 && (
                <Text style={styles.resendsCountText}>
                  Requested {resendsCount}/3 times
                </Text>
              )}
              {resendsCount >= 3 && (
                <Text style={styles.errorText}>
                  Maximum resends reached. Restart registration/login.
                </Text>
              )}
            </View>
          </Animated.View>

          <View style={styles.tipBox}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.tipText}>
              Using local developer settings? Enter <Text style={styles.boldText}>123456</Text> as the backdoor code to bypass verification smoothly.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, padding: Spacing.lg, paddingTop: 50 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    alignSelf: 'flex-start',
  },
  backText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightSemibold,
  },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10, marginBottom: Spacing.md,
  },
  heading: {
    fontSize: Typography.fontSize2XL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  subheading: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: Spacing.sm,
  },
  phoneHighlight: { color: Colors.primaryLight, fontWeight: Typography.fontWeightBold },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightSemibold,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  codeBoxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  codeBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeBoxFocused: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  codeBoxFilled: {
    borderColor: Colors.accent,
  },
  codeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize2XL,
    fontWeight: Typography.fontWeightBold,
  },
  statusRow: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  warningText: {
    color: Colors.warning,
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemibold,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemibold,
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  verifyBtnDisabled: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
  },
  resendContainer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cooldownText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeMD,
  },
  timerText: {
    color: Colors.accentLight,
    fontWeight: Typography.fontWeightBold,
  },
  resendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  resendBtnText: {
    color: Colors.primaryLight,
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
  },
  resendBtnTextDisabled: {
    color: Colors.textMuted,
  },
  resendsCountText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXS,
    marginTop: 4,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    padding: Spacing.md,
    marginTop: Spacing.xl,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeSM,
    lineHeight: 18,
    marginLeft: 8,
  },
  boldText: {
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
});
