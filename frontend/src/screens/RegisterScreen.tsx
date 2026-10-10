import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, StatusBar, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

export default function RegisterScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirm: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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

  const updateField = (field: string) => (val: string) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleRegister = async () => {
    const name = form.name.trim();
    const rawPhone = form.phone.trim();
    const password = form.password.trim();
    const confirm = form.confirm.trim();

    if (!name || !rawPhone || !password || !confirm) {
      shake();
      Alert.alert('Missing Fields', 'Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      shake();
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirm) {
      shake();
      Alert.alert('Password Mismatch', 'The passwords you entered do not match.');
      return;
    }

    // Normalize phone: strip non-digits, prepend +91 for 10-digit numbers
    const digits = rawPhone.replace(/[^0-9]/g, '');
    let phone = rawPhone;
    if (digits.length === 10) {
      phone = `+91${digits}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      phone = `+${digits}`;
    }

    setLoading(true);
    try {
      const res = await register({ name, phone, password });
      if (res && res.status === '2fa_pending') {
        navigation.navigate('OTPVerify', {
          session_id: res.session_id,
          phone: res.phone || phone,
          action: 'signup',
        });
      }
    } catch (err: any) {
      shake();
      let message = 'Registration failed. Please check your details and try again.';
      if (err?.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err?.response?.data?.error) {
        message = err.response.data.error;
      } else if (err?.message?.includes('Network Error') || !err?.response) {
        message = 'Unable to connect to the safety server. Please ensure your device has internet access.';
      }
      Alert.alert('Registration Failed', message);
    } finally {
      setLoading(false);
    }
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
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 24) + 24,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          overScrollMode="always"
        >
          <Animated.View style={[styles.innerContent, { opacity: fadeAnim }]}>
            {/* Top Navigation Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Sign Up</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Header Badge */}
            <View style={styles.header}>
              <LinearGradient
                colors={Colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="person-add" size={32} color={Colors.white} />
              </LinearGradient>
              <Text style={styles.heading}>Create Account</Text>
              <Text style={styles.subheading}>
                Join the SafeHer emergency safety network
              </Text>
            </View>

            {/* Registration Form Card */}
            <Animated.View
              style={[
                styles.formCard,
                { transform: [{ translateX: shakeAnim }] },
              ]}
            >
              {/* Full Name */}
              <View
                style={[
                  styles.inputGroup,
                  focusedField === 'name' && styles.inputGroupFocused,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={focusedField === 'name' ? Colors.primaryLight : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textMuted}
                  value={form.name}
                  onChangeText={updateField('name')}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Phone Number */}
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
                  placeholder="10-digit mobile number"
                  placeholderTextColor={Colors.textMuted}
                  value={form.phone}
                  onChangeText={updateField('phone')}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Password */}
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
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor={Colors.textMuted}
                  value={form.password}
                  onChangeText={updateField('password')}
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

              {/* Confirm Password */}
              <View
                style={[
                  styles.inputGroup,
                  focusedField === 'confirm' && styles.inputGroupFocused,
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={focusedField === 'confirm' ? Colors.primaryLight : Colors.textMuted}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.textMuted}
                  value={form.confirm}
                  onChangeText={updateField('confirm')}
                  secureTextEntry={!showConfirmPass}
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPass(!showConfirmPass)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={showConfirmPass ? Colors.primaryLight : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.buttonWrapper}
              >
                <LinearGradient
                  colors={Colors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                >
                  {loading ? (
                    <View style={styles.btnRow}>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={styles.submitBtnText}>  Creating Account...</Text>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
                      <Text style={styles.submitBtnText}>  Create Account</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.terms}>
                By creating an account, you agree to SafeHer's Terms of Service and Privacy Policy.
              </Text>
            </Animated.View>

            {/* Back to Login Link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text style={styles.loginHighlight}>Sign In</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
  buttonWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtn: {
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 0.4,
  },
  terms: {
    color: Colors.textMuted,
    fontSize: Typography.fontSizeXS,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 16,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    paddingVertical: Spacing.xs,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizeMD,
  },
  loginHighlight: {
    color: Colors.primaryLight,
    fontWeight: Typography.fontWeightBold,
  },
});
