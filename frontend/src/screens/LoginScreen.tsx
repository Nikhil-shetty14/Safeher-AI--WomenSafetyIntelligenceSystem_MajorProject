import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      shake();
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      shake();
      Alert.alert('Login Failed', err?.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.white} />
            </View>
            <Text style={styles.appName}>SafeHer AI</Text>
            <Text style={styles.tagline}>Your personal safety guardian 🛡️</Text>
          </View>

          {/* Form */}
          <Animated.View style={[styles.formCard, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.heading}>Welcome Back</Text>
            <Text style={styles.subheading}>Stay safe, stay connected</Text>

            <View style={styles.inputGroup}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <Text style={styles.loginBtnText}>Signing in...</Text>
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={Colors.white} />
                  <Text style={styles.loginBtnText}>  Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Emergency Access */}
            <View style={styles.divider}>
              <View style={styles.line} /><Text style={styles.dividerText}>or</Text><View style={styles.line} />
            </View>

            <TouchableOpacity
              style={styles.sosQuickBtn}
              onPress={() => Alert.alert('🚨 SOS', 'Call 100 (Police) or 1091 (Women Helpline) immediately!')}
            >
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.sosQuickText}>  Quick Emergency: Call 100</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
            <Text style={styles.registerText}>
              New to SafeHer? <Text style={styles.registerHighlight}>Create Account</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, padding: Spacing.lg, paddingTop: 60, justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 15, marginBottom: Spacing.md,
  },
  appName: {
    fontSize: Typography.fontSize3XL, fontWeight: Typography.fontWeightExtrabold,
    color: Colors.textPrimary, letterSpacing: 0.5,
  },
  tagline: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 4 },
  formCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.cardBorder,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 6,
  },
  heading: {
    fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary, marginBottom: 4,
  },
  subheading: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginBottom: Spacing.lg },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    marginBottom: Spacing.md, paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1, height: 52, color: Colors.textPrimary,
    fontSize: Typography.fontSizeLG,
  },
  eyeBtn: { padding: 4 },
  loginBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    height: 54, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.sm, shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: Colors.white, fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  line: { flex: 1, height: 1, backgroundColor: Colors.cardBorder },
  dividerText: { color: Colors.textMuted, marginHorizontal: 12, fontSize: Typography.fontSizeSM },
  sosQuickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.dangerLight, height: 48,
  },
  sosQuickText: { color: Colors.danger, fontWeight: Typography.fontWeightSemibold, fontSize: Typography.fontSizeMD },
  registerLink: { alignItems: 'center', marginTop: Spacing.lg },
  registerText: { color: Colors.textSecondary, fontSize: Typography.fontSizeMD },
  registerHighlight: { color: Colors.primaryLight, fontWeight: Typography.fontWeightBold },
});
