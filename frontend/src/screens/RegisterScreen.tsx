import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const Field = ({ icon, placeholder, field, form, set, secure, showPass, setShowPass, keyboard }: any) => (
  <View style={styles.inputGroup}>
    <Ionicons name={icon} size={20} color={Colors.textMuted} style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      value={(form as any)[field]}
      onChangeText={set(field)}
      secureTextEntry={secure && !showPass}
      keyboardType={keyboard || 'default'}
      autoCapitalize={field === 'email' ? 'none' : 'words'}
    />
    {secure && (
      <TouchableOpacity onPress={() => setShowPass(!showPass)}>
        <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    )}
  </View>
);

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const set = (field: string) => (val: string) => setForm((p) => ({ ...p, [field]: val }));

  const handleRegister = async () => {
    const { name, phone, password, confirm } = form;
    if (!name || !phone || !password) {
      return Alert.alert('Missing Fields', 'Please fill in all required fields.');
    }
    if (password !== confirm) {
      return Alert.alert('Password Mismatch', 'Passwords do not match.');
    }
    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      const res = await register({ name, phone, password });
      if (res && res.status === '2fa_pending') {
        navigation.navigate('OTPVerify', {
          session_id: res.session_id,
          phone: res.phone,
          action: 'signup',
        });
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.detail || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="person-add" size={32} color={Colors.white} />
            </View>
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Join SafeHer AI for your safety 💜</Text>
          </View>

          <View style={styles.formCard}>
            <Field icon="person-outline" placeholder="Full Name" field="name" form={form} set={set} />
            <Field icon="call-outline" placeholder="Phone Number (+91...)" field="phone" form={form} set={set} keyboard="phone-pad" />
            <Field icon="lock-closed-outline" placeholder="Password" field="password" form={form} set={set} secure showPass={showPass} setShowPass={setShowPass} />
            <Field icon="shield-checkmark-outline" placeholder="Confirm Password" field="confirm" form={form} set={set} secure showPass={showPass} setShowPass={setShowPass} />

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={Colors.white} />
              <Text style={styles.btnText}>  {loading ? 'Creating Account...' : 'Create Account'}</Text>
            </TouchableOpacity>

            <Text style={styles.terms}>
              By creating an account, you agree to our Terms of Service and Privacy Policy.
            </Text>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
            <Text style={styles.loginText}>
              Already have an account? <Text style={styles.loginHighlight}>Sign In</Text>
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
  inner: { flex: 1, padding: Spacing.lg, paddingTop: 50 },
  back: { marginBottom: Spacing.md },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  logoCircle: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10, marginBottom: Spacing.md,
  },
  heading: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  subheading: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 4 },
  formCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  inputGroup: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.cardBorder,
    marginBottom: Spacing.md, paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, height: 52, color: Colors.textPrimary, fontSize: Typography.fontSizeLG },
  btn: {
    backgroundColor: Colors.accent, borderRadius: BorderRadius.md, height: 54,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.sm,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4,
    shadowRadius: 12, elevation: 8,
  },
  btnText: { color: Colors.white, fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold },
  terms: { color: Colors.textMuted, fontSize: Typography.fontSizeXS, textAlign: 'center', marginTop: Spacing.md },
  loginLink: { alignItems: 'center', marginTop: Spacing.lg },
  loginText: { color: Colors.textSecondary, fontSize: Typography.fontSizeMD },
  loginHighlight: { color: Colors.primaryLight, fontWeight: Typography.fontWeightBold },
});
