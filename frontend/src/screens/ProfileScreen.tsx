import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Switch,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { profileAPI, authAPI, BASE_URL } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

// Moved components OUTSIDE of the main component to prevent unmounting on re-render
const Section = ({ title, icon, children }: any) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

const SettingRow = ({ icon, label, value, onPress, toggle, toggleVal, onToggle, last }: any) => (
  <TouchableOpacity 
    style={[styles.settingRow, last && { borderBottomWidth: 0 }]} 
    onPress={onPress} 
    disabled={!!toggle} 
    activeOpacity={0.7}
  >
    <View style={styles.settingLeft}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
    </View>
    {toggle ? (
      <Switch
        value={toggleVal}
        onValueChange={onToggle}
        trackColor={{ false: Colors.cardBorder, true: Colors.primary + '80' }}
        thumbColor={toggleVal ? Colors.primary : Colors.textMuted}
      />
    ) : (
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue} numberOfLines={1}>{value}</Text>}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
    )}
  </TouchableOpacity>
);

const InfoInput = ({ label, value, onChangeText, placeholder, keyboardType }: any) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={keyboardType}
    />
  </View>
);

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, updateUser } = useAuth();
  const { isConnected } = useSocket();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [historySummary, setHistorySummary] = useState<any>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    fetchProfile();
    fetchHistorySummary();
  }, []);

  // Profile Fields
  const [profileData, setProfileData] = useState<any>({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    age: user?.age?.toString() || '',
    gender: user?.gender || '',
    address: user?.address || '',
    blood_group: user?.blood_group || '',
    medical_conditions: user?.medical_conditions || '',
    allergies: user?.allergies || '',
  });

  // Preferences
  const [safetyPrefs, setSafetyPrefs] = useState(user?.safety_preferences || {
    sos_auto_activation: false,
    shake_detection: false,
    shake_sensitivity: 2.8,
    voice_triggered_sos: false,
    hidden_sos_mode: false,
    live_tracking_enabled: true,
  });

  const [notifSettings, setNotifSettings] = useState(user?.notification_settings || {
    sms_alerts: true,
    emergency_calls: true,
    push_notifications: true,
    notification_sounds: true,
  });

  const [securitySettings, setSecuritySettings] = useState(user?.security_settings || {
    biometric_login: false,
    two_factor_auth: false,
  });

  const fetchProfile = async () => {
    try {
      const res = await profileAPI.getMe();
      const userData = res.data;
      updateUser(userData);
      setProfileData({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        age: userData.age?.toString() || '',
        gender: userData.gender || '',
        address: userData.address || '',
        blood_group: userData.blood_group || '',
        medical_conditions: userData.medical_conditions || '',
        allergies: userData.allergies || '',
      });
      setSafetyPrefs(userData.safety_preferences);
      setNotifSettings(userData.notification_settings);
      setSecuritySettings(userData.security_settings);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchHistorySummary = async () => {
    try {
      const res = await profileAPI.getHistorySummary();
      setHistorySummary(res.data);
    } catch (error) {
      console.error('Error fetching history summary:', error);
    }
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const res = await profileAPI.update({
        ...profileData,
        age: profileData.age ? parseInt(profileData.age) : null,
      });
      updateUser(res.data);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const toggleSafetyPref = async (key: string) => {
    const newPrefs = { ...safetyPrefs, [key]: !safetyPrefs[key] };
    setSafetyPrefs(newPrefs);
    try {
      await profileAPI.updateSafety(newPrefs);
    } catch (error) {
      setSafetyPrefs(safetyPrefs); // revert
    }
  };

  const toggleNotifSetting = async (key: string) => {
    const newSettings = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(newSettings);
    try {
      await profileAPI.updateNotifications(newSettings);
    } catch (error) {
      setNotifSettings(notifSettings); // revert
    }
  };

  const toggleSecuritySetting = async (key: string) => {
    const newSettings = { ...securitySettings, [key]: !securitySettings[key] };
    setSecuritySettings(newSettings);
    try {
      await profileAPI.updateSecurity(newSettings);
    } catch (error) {
      setSecuritySettings(securitySettings); // revert
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    const formData = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : `image`;

    formData.append('file', { uri, name: filename, type } as any);

    try {
      setLoading(true);
      const res = await profileAPI.uploadPhoto(formData);
      updateUser({ profile_image: res.data.profile_image });
      Alert.alert('Success', 'Profile photo updated');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      
      <LinearGradient colors={Colors.gradientBg} style={StyleSheet.absoluteFill} />

      <Animated.ScrollView 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, { opacity: fadeAnim }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile & Security</Text>
          <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : <Text style={styles.saveBtn}>Save</Text>}
          </TouchableOpacity>
        </View>

        {/* Profile Info Card */}
        <View style={styles.profileMainCard}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {user?.profile_image ? (
              <Image source={{ uri: `${BASE_URL}${user.profile_image}` }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={Colors.white} />
              </View>
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color={Colors.white} />
            </View>
            <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.warning }]} />
          </TouchableOpacity>
          
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{historySummary?.total_sos_alerts || 0}</Text>
              <Text style={styles.statLabel}>SOS Alerts</Text>
            </View>
            <View style={[styles.statItem, styles.statBorder]}>
              <Text style={styles.statValue}>{historySummary?.total_ai_checks || 0}</Text>
              <Text style={styles.statLabel}>AI Checks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>Gold</Text>
              <Text style={styles.statLabel}>Plan</Text>
            </View>
          </View>
        </View>

        {/* Basic Info */}
        <Section title="Basic Information" icon="person-outline">
          <InfoInput 
            label="Full Name" 
            value={profileData.name} 
            onChangeText={(t: string) => setProfileData({...profileData, name: t})}
            placeholder="Enter your name"
          />
          <InfoInput 
            label="Phone Number" 
            value={profileData.phone} 
            onChangeText={(t: string) => setProfileData({...profileData, phone: t})}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <InfoInput 
                label="Age" 
                value={profileData.age} 
                onChangeText={(t: string) => setProfileData({...profileData, age: t})}
                placeholder="Years"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <InfoInput 
                label="Gender" 
                value={profileData.gender} 
                onChangeText={(t: string) => setProfileData({...profileData, gender: t})}
                placeholder="Gender"
              />
            </View>
          </View>
          <InfoInput 
            label="Home Address" 
            value={profileData.address} 
            onChangeText={(t: string) => setProfileData({...profileData, address: t})}
            placeholder="Set your home address"
          />
        </Section>

        {/* Emergency Info */}
        <Section title="Health & Emergency" icon="heart-outline">
          <SettingRow 
            icon="people-outline" 
            label="Emergency Contacts" 
            value={`${user?.role === 'user' ? 'Manage' : 'View'}`} 
            onPress={() => navigation.navigate('Main', { screen: 'Contacts' })} 
          />
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <InfoInput 
                label="Blood Group" 
                value={profileData.blood_group} 
                onChangeText={(t: string) => setProfileData({...profileData, blood_group: t})}
                placeholder="e.g. O+"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <InfoInput 
                label="Allergies" 
                value={profileData.allergies} 
                onChangeText={(t: string) => setProfileData({...profileData, allergies: t})}
                placeholder="e.g. Peanuts"
              />
            </View>
          </View>
          <InfoInput 
            label="Medical Conditions" 
            value={profileData.medical_conditions} 
            onChangeText={(t: string) => setProfileData({...profileData, medical_conditions: t})}
            placeholder="Any conditions..."
          />
        </Section>

        {/* Safety Preferences */}
        <Section title="Safety Preferences" icon="shield-outline">
          <SettingRow 
            icon="flash-outline" 
            label="SOS Auto Activation" 
            toggle 
            toggleVal={safetyPrefs.sos_auto_activation} 
            onToggle={() => toggleSafetyPref('sos_auto_activation')} 
          />
          <SettingRow 
            icon="hand-right-outline" 
            label="Shake Detection" 
            toggle 
            toggleVal={safetyPrefs.shake_detection} 
            onToggle={() => toggleSafetyPref('shake_detection')} 
          />
          <SettingRow 
            icon="mic-outline" 
            label="Voice-triggered SOS" 
            toggle 
            toggleVal={safetyPrefs.voice_triggered_sos} 
            onToggle={() => toggleSafetyPref('voice_triggered_sos')} 
          />
          <SettingRow 
            icon="eye-off-outline" 
            label="Hidden SOS Mode" 
            toggle 
            toggleVal={safetyPrefs.hidden_sos_mode} 
            onToggle={() => toggleSafetyPref('hidden_sos_mode')} 
          />
          <SettingRow 
            icon="location-outline" 
            label="Live Tracking" 
            toggle 
            toggleVal={safetyPrefs.live_tracking_enabled} 
            onToggle={() => toggleSafetyPref('live_tracking_enabled')} 
          />
          <View style={styles.sensitivityContainer}>
            <Text style={styles.sensitivityLabel}>Shake Sensitivity</Text>
            <View style={styles.sensitivityOptions}>
              {[
                { label: 'Low', val: 3.5 },
                { label: 'Med', val: 2.8 },
                { label: 'High', val: 2.0 }
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.sensitivityBtn,
                    safetyPrefs.shake_sensitivity === opt.val && styles.sensitivityBtnActive
                  ]}
                  onPress={async () => {
                    const newPrefs = { ...safetyPrefs, shake_sensitivity: opt.val };
                    setSafetyPrefs(newPrefs);
                    try {
                      await profileAPI.updateSafety(newPrefs);
                    } catch (e) {}
                  }}
                >
                  <Text style={[
                    styles.sensitivityBtnText,
                    safetyPrefs.shake_sensitivity === opt.val && styles.sensitivityBtnTextActive
                  ]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Section>

        {/* Notification Settings */}
        <Section title="Notification Settings" icon="notifications-outline">
          <SettingRow 
            icon="chatbubble-outline" 
            label="SMS Alerts" 
            toggle 
            toggleVal={notifSettings.sms_alerts} 
            onToggle={() => toggleNotifSetting('sms_alerts')} 
          />
          <SettingRow 
            icon="call-outline" 
            label="Emergency Calls" 
            toggle 
            toggleVal={notifSettings.emergency_calls} 
            onToggle={() => toggleNotifSetting('emergency_calls')} 
          />
          <SettingRow 
            icon="notifications-outline" 
            label="Push Notifications" 
            toggle 
            toggleVal={notifSettings.push_notifications} 
            onToggle={() => toggleNotifSetting('push_notifications')} 
          />
          <SettingRow 
            icon="volume-high-outline" 
            label="Alert Sounds" 
            toggle 
            toggleVal={notifSettings.notification_sounds} 
            onToggle={() => toggleNotifSetting('notification_sounds')} 
            last
          />
        </Section>

        {/* Security Features */}
        <Section title="Security & Privacy" icon="lock-closed-outline">
          <SettingRow 
            icon="finger-print-outline" 
            label="Biometric Login" 
            toggle 
            toggleVal={securitySettings.biometric_login} 
            onToggle={() => toggleSecuritySetting('biometric_login')} 
          />
          <SettingRow 
            icon="key-outline" 
            label="Two-Factor Auth" 
            toggle 
            toggleVal={securitySettings.two_factor_auth} 
            onToggle={() => toggleSecuritySetting('two_factor_auth')} 
          />
          <SettingRow 
            icon="create-outline" 
            label="Change Password" 
            onPress={() => Alert.alert('Security', 'Please check your email to reset password.')} 
          />
          <SettingRow 
            icon="shield-checkmark-outline" 
            label="App Permissions" 
            onPress={() => Alert.alert('Permissions', 'All required permissions are granted.')} 
            last
          />
        </Section>

        {/* History */}
        <Section title="Safety History" icon="time-outline">
          <SettingRow 
            icon="alert-circle-outline" 
            label="SOS Alert History" 
            onPress={() => navigation.navigate('AlertHistory')} 
          />
          <SettingRow 
            icon="bulb-outline" 
            label="AI Risk Reports" 
            onPress={() => Alert.alert('AI Reports', 'No critical threats detected recently.')} 
            last
          />
        </Section>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LinearGradient 
            colors={[Colors.danger + '20', Colors.danger + '10'] as any} 
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
            <Text style={styles.logoutText}>Logout from SafeHer</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerText}>SafeHer AI v1.0.0 • Production Ready</Text>
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  headerTitle: { fontSize: Typography.fontSizeXL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  saveBtn: { color: Colors.primary, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeLG },
  profileMainCard: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  profileName: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  profileEmail: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.cardBorder },
  statValue: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  statLabel: { fontSize: Typography.fontSizeXS, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase' },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8, paddingLeft: 4 },
  sectionTitle: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, fontWeight: Typography.fontWeightSemibold, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.backgroundSecondary, justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  settingValue: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, maxWidth: 120 },
  inputContainer: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  inputLabel: { fontSize: Typography.fontSizeXS, color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  textInput: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary, paddingVertical: 4 },
  rowInputs: { flexDirection: 'row' },
  logoutBtn: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: 8,
  },
  logoutText: { color: Colors.danger, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeMD },
  footerText: { textAlign: 'center', color: Colors.textMuted, fontSize: Typography.fontSizeXS, marginTop: Spacing.xl },
  sensitivityContainer: { padding: Spacing.md, gap: 10 },
  sensitivityLabel: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary, fontWeight: '600' },
  sensitivityOptions: { flexDirection: 'row', gap: 10 },
  sensitivityBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.backgroundSecondary, alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder },
  sensitivityBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sensitivityBtnText: { color: Colors.textMuted, fontWeight: '700', fontSize: 12 },
  sensitivityBtnTextActive: { color: Colors.white },
});
