import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, StatusBar, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { authAPI } from '../api/client';

export default function ResetPasswordScreen({ route, navigation }: any) {
  const { session_id, phone } = route.params || {};
  
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Resend OTP state
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resendsCount, setResendsCount] = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
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

  const handleReset = async () => {
    if (code.length !== 6) {
      shake();
      Alert.alert('Missing Field', 'Please enter the 6-digit OTP code.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      shake();
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      shake();
      Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({
        session_id,
        otp_code: code,
        new_password: newPassword
      });
      
      Alert.alert('Success', 'Your password has been reset successfully!', [
        { text: 'Login Now', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (err: any) {
      shake();
      const errorMsg = err?.response?.data?.detail || 'Failed to reset password. Please try again.';
      Alert.alert('Error', errorMsg);
      if (errorMsg.includes('blocked') || errorMsg.includes('expired') || errorMsg.includes('Maximum')) {
         navigation.goBack();
      }
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
      await authAPI.resendOTP({ session_id });
      Alert.alert('Success', 'A new verification code has been sent to your phone number.');
      setCountdown(60);
      setResendsCount((prev) => prev + 1);
      setCode('');
    } catch (err: any) {
      Alert.alert('Resend Failed', err?.response?.data?.detail || 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
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
              <Ionicons name="key" size={36} color={Colors.white} />
            </View>
            <Text style={styles.heading}>Create New Password</Text>
            <Text style={styles.subheading}>
              Enter the 6-digit OTP sent to <Text style={styles.phoneHighlight}>{phone}</Text> along with your new password.
            </Text>
          </View>

          <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
            
            <Text style={styles.label}>Verification Code (OTP)</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={Colors.textMuted}
                value={code}
                onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Confirm your new password"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPass}
              />
              <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeBtn}>
                <Ionicons name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.btn,
                (code.length !== 6 || loading || !newPassword || !confirmPassword) && styles.btnDisabled,
              ]}
              onPress={handleReset}
              disabled={code.length !== 6 || loading || !newPassword || !confirmPassword}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={20} color={Colors.white} />
                  <Text style={styles.btnText}>  Reset Password</Text>
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
                    <Text style={[styles.resendBtnText, resendsCount >= 3 && styles.resendBtnTextDisabled]}>
                      {resendsCount >= 3 ? 'Resends Blocked' : 'Resend Verification Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
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
    marginBottom: 6,
  },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg, paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1, height: 52, color: Colors.textPrimary,
    fontSize: Typography.fontSizeLG,
  },
  eyeBtn: { padding: 4 },
  btn: {
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
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
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
});
