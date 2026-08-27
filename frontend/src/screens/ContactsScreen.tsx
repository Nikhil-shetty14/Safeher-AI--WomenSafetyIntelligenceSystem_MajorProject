import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contactsAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

const RELATIONSHIPS = ['Mother', 'Father', 'Sister', 'Brother', 'Friend', 'Husband', 'Partner', 'Other'];

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', relationship: 'Mother', email: '', is_primary: false });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await contactsAPI.getAll();
      setContacts(res.data || []);
    } catch { setContacts([]); }
    if (showSpinner) setLoading(false);
  };

  const openAdd = () => {
    setForm({ name: '', phone: '', relationship: 'Mother', email: '', is_primary: false });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (c: any) => {
    setForm({ name: c.name, phone: c.phone, relationship: c.relationship, email: c.email || '', is_primary: c.is_primary });
    setEditId(c.id);
    setModal(true);
  };

  const save = async () => {
    const cleanPhone = form.phone.replace(/[^0-9+]/g, '');
    if (!form.name.trim() || cleanPhone.length < 10) {
      return Alert.alert('Required', 'Name and valid phone number (min 10 digits) are required.');
    }
    
    setSaving(true);
    try {
      const payload = { ...form, phone: cleanPhone };
      if (editId) {
        await contactsAPI.update(editId, payload);
      } else {
        await contactsAPI.add(payload);
      }
      setModal(false);
      await fetchContacts(false);
    } catch (err: any) {
      let errorMsg = 'Failed to save contact.';
      
      if (err?.response?.data) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMsg = detail.map((d: any) => `${d.loc.join('.')} - ${d.msg}`).join('\n');
        } else if (typeof detail === 'string') {
          errorMsg = detail;
        } else {
          errorMsg = JSON.stringify(err.response.data);
        }
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      Alert.alert('Save Error', errorMsg);
    }
    setSaving(false);
  };

  const deleteContact = (id: string, name: string) => {
    Alert.alert('Delete Contact', `Remove ${name} from emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await contactsAPI.delete(id); fetchContacts(); }
          catch { Alert.alert('Error', 'Failed to delete.'); }
        }
      }
    ]);
  };

  const set = (field: string) => (val: any) => setForm((p) => ({ ...p, [field]: val }));

  const renderContact = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: item.is_primary ? Colors.danger + '30' : Colors.primary + '20' }]}>
        <Ionicons name="person" size={24} color={item.is_primary ? Colors.danger : Colors.primary} />
      </View>
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <Text style={styles.name}>{item.name}</Text>
          {item.is_primary && (
            <View style={styles.primaryBadge}>
              <Ionicons name="star" size={10} color={Colors.danger} />
              <Text style={styles.primaryText}> Primary</Text>
            </View>
          )}
        </View>
        <Text style={styles.phone}>{item.phone}</Text>
        <Text style={styles.relation}>{item.relationship}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Ionicons name="pencil" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => deleteContact(item.id, item.name)}>
          <Ionicons name="trash" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>👥 Emergency Contacts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={18} color={Colors.primary} />
        <Text style={styles.infoText}>
          These contacts will receive SMS alerts with your GPS location during an SOS.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Emergency Contacts</Text>
          <Text style={styles.emptySubtitle}>Add trusted contacts who'll be notified during an SOS emergency.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
            <Ionicons name="add-circle" size={20} color={Colors.white} />
            <Text style={styles.emptyBtnText}>  Add First Contact</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(c) => c.id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editId ? 'Edit Contact' : 'Add Contact'}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {[
              { placeholder: 'Full Name *', field: 'name' },
              { placeholder: 'Phone (+91....) *', field: 'phone', keyboard: 'phone-pad' },
              { placeholder: 'Email (optional)', field: 'email', keyboard: 'email-address' },
            ].map((f) => (
              <TextInput
                key={f.field}
                style={styles.modalInput}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.textMuted}
                value={(form as any)[f.field]}
                onChangeText={set(f.field)}
                keyboardType={(f.keyboard as any) || 'default'}
              />
            ))}

            <Text style={styles.fieldLabel}>Relationship</Text>
            <View style={styles.relRow}>
              {RELATIONSHIPS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.relChip, form.relationship === r && styles.relChipActive]}
                  onPress={() => setForm((p) => ({ ...p, relationship: r }))}
                >
                  <Text style={[styles.relChipText, form.relationship === r && { color: Colors.white }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.primaryToggle}
              onPress={() => setForm((p) => ({ ...p, is_primary: !p.is_primary }))}
            >
              <View style={[styles.toggle, form.is_primary && styles.toggleActive]}>
                {form.is_primary && <Ionicons name="checkmark" size={14} color={Colors.white} />}
              </View>
              <Text style={styles.toggleLabel}>Set as primary contact (will receive phone call)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color={Colors.white} size="small" /> : (
                <Text style={styles.saveBtnText}>{editId ? 'Update Contact' : 'Save Contact'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, paddingTop: 55,
  },
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.primary, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  infoText: { flex: 1, color: Colors.textSecondary, fontSize: Typography.fontSizeSM, lineHeight: 18 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightSemibold, color: Colors.textPrimary },
  primaryBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.danger + '20',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  primaryText: { fontSize: 9, color: Colors.danger, fontWeight: Typography.fontWeightBold },
  phone: { fontSize: Typography.fontSizeMD, color: Colors.textSecondary, marginTop: 2 },
  relation: { fontSize: Typography.fontSizeSM, color: Colors.textMuted, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 12 },
  emptyTitle: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  emptySubtitle: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary,
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: BorderRadius.full, marginTop: 8,
  },
  emptyBtnText: { color: Colors.white, fontWeight: Typography.fontWeightBold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, maxHeight: '90%', borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.fontSizeXL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  modalInput: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    height: 50, color: Colors.textPrimary, fontSize: Typography.fontSizeMD,
    borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: Spacing.sm,
  },
  fieldLabel: { color: Colors.textSecondary, fontSize: Typography.fontSizeSM, marginBottom: 8, fontWeight: Typography.fontWeightMedium },
  relRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  relChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  relChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  relChipText: { color: Colors.textMuted, fontSize: Typography.fontSizeSM },
  primaryToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.lg },
  toggle: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.cardBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleLabel: { flex: 1, color: Colors.textSecondary, fontSize: Typography.fontSizeSM },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 52,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnText: { color: Colors.white, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeLG },
});
