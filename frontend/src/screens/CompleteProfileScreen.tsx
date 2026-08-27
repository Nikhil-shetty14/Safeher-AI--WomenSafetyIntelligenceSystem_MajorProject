import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../api/client';
import { Ionicons } from '@expo/vector-icons';

const KARNATAKA_DIVISIONS = [
  "Bangalore Division",
  "Belagavi Division",
  "Kalaburagi Division",
  "Mysuru Division"
];

const KARNATAKA_DISTRICTS: Record<string, string[]> = {
  "Bangalore Division": [
    "Bengaluru Urban", "Bengaluru Rural", "Ramanagara", "Chikkaballapura", 
    "Chitradurga", "Davanagere", "Kolar", "Shivamogga", "Tumakuru"
  ],
  "Belagavi Division": [
    "Bagalkot", "Belagavi", "Vijayapura", "Dharwad", "Gadag", "Haveri", "Uttara Kannada"
  ],
  "Kalaburagi Division": [
    "Ballari", "Bidar", "Kalaburagi", "Koppal", "Raichur", "Yadgir", "Vijayanagara"
  ],
  "Mysuru Division": [
    "Chamarajanagar", "Chikkamagaluru", "Dakshina Kannada", "Hassan", 
    "Kodagu", "Mandya", "Mysuru", "Udupi"
  ]
};

export default function CompleteProfileScreen() {
  const { user, updateUser } = useAuth();
  const [division, setDivision] = useState(user?.division || '');
  const [district, setDistrict] = useState(user?.district || '');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);

  const handleSave = async () => {
    if (!division || !district) {
      Alert.alert('Missing Fields', 'Please select both division and district.');
      return;
    }

    setLoading(true);
    try {
      await profileAPI.update({ division, district });
      updateUser({ division, district });
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const availableDistricts = division && KARNATAKA_DISTRICTS[division] ? KARNATAKA_DISTRICTS[division] : [];

  const SelectionModal = ({ visible, onClose, data, title, onSelect, selectedValue }: any) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.modalItem, selectedValue === item && styles.modalItemSelected]}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <Text style={[styles.modalItemText, selectedValue === item && styles.modalItemTextSelected]}>
                  {item}
                </Text>
                {selectedValue === item && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="location-outline" size={48} color={Colors.white} />
          </View>
          <Text style={styles.heading}>Select Your Region</Text>
          <Text style={styles.subheading}>Please select your administrative division and district in Karnataka.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Division</Text>
          <TouchableOpacity 
            style={styles.dropdownBtn} 
            onPress={() => setShowDivisionModal(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, !division && styles.placeholderText]}>
              {division || "Select Division"}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.label}>District</Text>
          <TouchableOpacity 
            style={[styles.dropdownBtn, !division && styles.dropdownBtnDisabled]} 
            onPress={() => division ? setShowDistrictModal(true) : Alert.alert('Notice', 'Please select a division first.')}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, !district && styles.placeholderText]}>
              {district || "Select District"}
            </Text>
            <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, (!division || !district) && styles.btnDisabled]} onPress={handleSave} disabled={loading || !division || !district}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.btnText}>Continue to Home</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      <SelectionModal 
        visible={showDivisionModal} 
        onClose={() => setShowDivisionModal(false)} 
        data={KARNATAKA_DIVISIONS} 
        title="Select Division" 
        onSelect={(val: string) => {
          setDivision(val);
          if (val !== division) setDistrict(''); // Reset district if division changes
        }} 
        selectedValue={division} 
      />
      
      <SelectionModal 
        visible={showDistrictModal} 
        onClose={() => setShowDistrictModal(false)} 
        data={availableDistricts} 
        title="Select District" 
        onSelect={setDistrict} 
        selectedValue={district} 
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  heading: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  subheading: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  label: { fontSize: Typography.fontSizeMD, fontWeight: Typography.fontWeightSemibold, color: Colors.textPrimary, marginBottom: 8 },
  dropdownBtn: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md, height: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  dropdownBtnDisabled: {
    opacity: 0.5, backgroundColor: Colors.background,
  },
  dropdownText: {
    fontSize: Typography.fontSizeMD, color: Colors.textPrimary, flex: 1,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  btn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: { color: Colors.white, fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold },
  
  // Modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    maxHeight: '80%', minHeight: '50%', paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  modalTitle: {
    fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  modalItemSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)', // subtle primary color
  },
  modalItemText: {
    fontSize: Typography.fontSizeMD, color: Colors.textPrimary,
  },
  modalItemTextSelected: {
    fontWeight: Typography.fontWeightBold, color: Colors.primary,
  },
  separator: {
    height: 1, backgroundColor: Colors.cardBorder,
  }
});
