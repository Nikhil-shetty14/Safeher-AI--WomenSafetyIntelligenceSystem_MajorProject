import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { complaintsAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

export default function MyComplaintsScreen({ navigation }: any) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const res = await complaintsAPI.getMyComplaints();
      setComplaints(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'Resolved' ? Colors.success + '20' : Colors.warning + '20' }]}>
          <Text style={[styles.statusText, { color: item.status === 'Resolved' ? Colors.success : Colors.warning }]}>
            {item.status}
          </Text>
        </View>
      </View>
      
      <Text style={styles.cardMeta}>ID: {item.id}</Text>
      
      <View style={styles.cardRow}>
        <Ionicons name="location" size={14} color={Colors.textMuted} />
        <Text style={styles.cardText}>{item.district}, {item.state}</Text>
      </View>
      
      <View style={styles.cardRow}>
        <Ionicons name="time" size={14} color={Colors.textMuted} />
        <Text style={styles.cardText}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>

      {item.admin_remarks && (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Admin Remarks:</Text>
          <Text style={styles.remarksText}>{item.admin_remarks}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Complaints</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyText}>You haven't filed any complaints yet.</Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}
      
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('SubmitComplaint')}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    backgroundColor: Colors.card
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.white },
  listContainer: { padding: Spacing.lg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: Colors.textMuted, marginTop: 16, fontSize: 16 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadows.card
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  cardMeta: { fontSize: 12, color: Colors.primaryLight, fontWeight: '600', marginBottom: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardText: { fontSize: 14, color: Colors.textSecondary, marginLeft: 6 },
  remarksBox: { marginTop: 12, padding: 12, backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.md },
  remarksLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  remarksText: { fontSize: 13, color: Colors.textPrimary },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card
  }
});
