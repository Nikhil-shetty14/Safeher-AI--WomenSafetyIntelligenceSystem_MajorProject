import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, StatusBar, ActivityIndicator, Linking
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

export default function LoginScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'phone' | 'password' | null>(null);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 70, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();

    if (!cleanPhone || !cleanPass) {
      shake();
      Alert.alert('Missing Details', 'Please enter both your mobile number and password.');
      return;
    }

    // Normalize phone: strip non-digits, prepend +91 for 10-digit numbers
    const digits = cleanPhone.replace(/[^0-9]/g, '');
    let normalizedPhone = cleanPhone;
    if (digits.length === 10) {
      normalizedPhone = `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      normalizedPhone = `+${digits}`;
    }

    setLoading(true);
    try {
      const res = await login(normalizedPhone, cleanPass);
      if (res && res.status === '2fa_pending') {
        navigation.navigate('OTPVerify', {
          session_id: res.session_id,
          phone: res.phone || normalizedPhone,
          action: 'login',
        });
      }
    } catch (err: any) {
      shake();
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        (err?.message?.includes('Network Error')
          ? 'Unable to connect to safety server. Please verify your connection.'
          : 'Invalid mobile number or password. Please try again.');
      Alert.alert('Sign In Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      '🚨 Emergency Helpline',
      'Select a helpline to call immediately:',
      [
        { text: 'Call Police (100)', onPress: () => Linking.openURL('tel:100') },
        { text: 'Women Helpline (1091)', onPress: () => Linking.openURL('tel:1091') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, 24) + 16,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          overScrollMode="always"
        >
          <Animated.View style={[styles.innerContent, { opacity: fadeAnim }]}>
            {/* Brand Header */}
            <View style={styles.logoWrap}>
              <LinearGradient
                colors={Colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="shield-checkmark" size={44} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.appName}>SafeHer AI</Text>
              <Text style={styles.tagline}>Smart Safety & Emergency Protection</Text>
            </View>

            {/* Login Card */}
            <Animated.View
              style={[
                styles.formCard,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              <Text style={styles.heading}>Welcome Back</Text>
              <Text style={styles.subheading}>
                Sign in to activate your emergency safety network
              </Text>

              {/* Phone Field */}
              <View
                style={[
                  styles.inputGroup,
                  focusedField === 'phone' && styles.inputGroupFocused,
                ]}
              >
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={focusedField === 'phone' ? Colors.primaryLight : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+91</Text>
                  <View style={styles.codeDivider} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Password Field */}
              <View
                style={[
                  styles.inputGroup,
                  focusedField === 'password' && styles.inputGroupFocused,
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={focusedField === 'password' ? Colors.primaryLight : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(!showPass)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={showPass ? Colors.primaryLight : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                style={styles.forgotPasswordLink}
                onPress={() => navigation.navigate('ForgotPassword')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={Colors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                >
                  {loading ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={styles.loginBtnText}>  Signing In...</Text>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                      <Text style={styles.loginBtnText}>  Sign In</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Emergency Fast Access */}
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>EMERGENCY</Text>
                <View style={styles.line} />
              </View>

              <TouchableOpacity
                style={styles.sosQuickBtn}
                onPress={handleEmergencyCall}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.sosQuickText}>  Quick Emergency Call (100 / 1091)</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Navigation to Register */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.registerText}>
                New to SafeHer?{' '}
                <Text style={styles.registerHighlight}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  innerContent: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoGradient: {
    width: 82,
    height: 82,
    borderRadius: 41,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm + 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  appName: {
    fontSize: Typography.fontSize3XL,
    fontWeight: Typography.fontWeightExtrabold,
    color: Colors.textPrimary,
    letterSpacing: 0.6,
  },
  tagline: {
    fontSize: Typography.fontSizeMD,
    color: Colors.textSecondary,
    marginTop: 4,
    fontWeight: Typography.fontWeightMedium,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  heading: {
    fontSize: Typography.fontSize2XL,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  subheading: {
    fontSize: Typography.fontSizeSM + 1,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputGroupFocused: {
    borderColor: Colors.primaryLight,
    backgroundColor: Colors.backgroundSecondary,
  },
  inputIcon: {
    marginRight: 8,
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  countryCodeText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizeMD,
    fontWeight: Typography.fontWeightBold,
    marginRight: 8,
  },
  codeDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.cardBorder,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Colors.textPrimary,
    fontSize: Typography.fontSizeMD,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.md,
    marginTop: -2,
  },
  forgotPasswordText: {
    color: Colors.primaryLight,
    fontSize: Typography.fontSizeSM,
    fontWeight: Typography.fontWeightSemibold,
  },
  buttonWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: 4,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  loginBtn: {
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 0.4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.cardBorder,
  },
  dividerText: {
    color: Colors.textMuted,
    marginHorizontal: 12,
    fontSize: Typography.fontSizeXS,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 1,
  },
  sosQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    height: 46,
  },
  sosQuickText: {
    color: Colors.danger,
    fontWeight: Typography.fontWeightSemibold,
    fontSize: Typography.fontSizeSM + 1,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  registerText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeMD,
  },
  registerHighlight: {
    color: Colors.primaryLight,
    fontWeight: Typography.fontWeightBold,
  },
});
