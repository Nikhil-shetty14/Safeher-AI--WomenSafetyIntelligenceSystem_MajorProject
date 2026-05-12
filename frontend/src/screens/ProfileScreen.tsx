import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const [shakeSOS, setShakeSOS] = useState(true);
  const [bgTracking, setBgTracking] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const SettingRow = ({ icon, label, value, onPress, toggle, toggleVal, onToggle }: any) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!!toggle} activeOpacity={0.7}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {toggle ? (
        <Switch
          value={toggleVal}
          onValueChange={onToggle}
          trackColor={{ false: Colors.cardBorder, true: Colors.primary + '60' }}
          thumbColor={toggleVal ? Colors.primary : Colors.textMuted}
        />
      ) : (
        <View style={styles.settingRight}>
          {value && <Text style={styles.settingValue}>{value}</Text>}
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile & Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={48} color={Colors.white} />
            <View style={[styles.connDot, { backgroundColor: isConnected ? Colors.success : Colors.warning }]} />
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <Text style={styles.profilePhone}>{user?.phone}</Text>
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark" size={12} color={Colors.primary} />
            <Text style={styles.roleText}> {user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Settings */}
        <Section title="Safety Settings">
          <SettingRow icon="phone-portrait-outline" label="Shake-to-SOS" toggle toggleVal={shakeSOS} onToggle={setShakeSOS} />
          <SettingRow icon="location-outline" label="Background Tracking" toggle toggleVal={bgTracking} onToggle={setBgTracking} />
          <SettingRow icon="notifications-outline" label="Push Notifications" toggle toggleVal={notifications} onToggle={setNotifications} />
        </Section>

        <Section title="Account">
          <SettingRow icon="create-outline" label="Edit Profile" onPress={() => Alert.alert('Edit Profile', 'Coming soon!')} />
          <SettingRow icon="lock-closed-outline" label="Change Password" onPress={() => Alert.alert('Change Password', 'Coming soon!')} />
          <SettingRow icon="alert-circle-outline" label="Alert History" onPress={() => navigation.navigate('AlertHistory')} />
        </Section>

        <Section title="About SafeHer AI">
          <SettingRow icon="information-circle-outline" label="App Version" value="1.0.0" />
          <SettingRow icon="document-text-outline" label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Your data is encrypted and never shared.')} />
        </Section>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>  Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    paddingTop: 55,
  },
  backBtn: {},
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  profileCard: {
    alignItems: 'center',
    margin: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  avatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  connDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  profileName: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  profileEmail: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 4 },
  profilePhone: { fontSize: Typography.fontSizeMD, color: Colors.textMuted, marginTop: 2 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: 10,
  },
  roleText: { color: Colors.primary, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeSM },
  section: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, fontWeight: Typography.fontWeightSemibold, marginBottom: 8, paddingLeft: 4 },
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
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  settingLabel: { fontSize: Typography.fontSizeMD, color: Colors.textPrimary },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: Typography.fontSizeSM, color: Colors.textMuted },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: Spacing.lg,
    backgroundColor: Colors.danger + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.danger + '40',
  },
  logoutText: { color: Colors.danger, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeLG },
});
