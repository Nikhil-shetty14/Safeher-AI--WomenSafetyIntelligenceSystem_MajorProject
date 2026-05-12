import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, StatusBar, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sosAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, getSeverityColor } from '../constants/theme';

export default function AlertHistoryScreen({ navigation }: any) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAlerts(); }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await sosAPI.getMyAlerts(0, 50);
      setAlerts(res.data || []);
    } catch { setAlerts([]); }
    setLoading(false);
  };

  const renderAlert = ({ item }: { item: any }) => {
    const color = getSeverityColor(item.severity);
    return (
      <View style={[styles.card, { borderLeftColor: color }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>{item.severity?.toUpperCase()}</Text>
          </View>
          <Text style={styles.trigger}>{item.trigger_type?.toUpperCase()} TRIGGER</Text>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? Colors.danger + '20' : Colors.success + '20' }]}>
            <Text style={[styles.statusText, { color: item.status === 'active' ? Colors.danger : Colors.success }]}>
              {item.status?.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
        {item.location && (
          <Text style={styles.location}>
            📍 {item.location.latitude?.toFixed(4)}, {item.location.longitude?.toFixed(4)}
          </Text>
        )}
        {item.message && <Text style={styles.message} numberOfLines={2}>"{item.message}"</Text>}
        {item.ai_analysis?.danger_level && (
          <Text style={styles.aiNote}>🤖 AI: {item.ai_analysis.danger_level} risk — {item.ai_analysis.suggested_action?.substring(0, 60)}...</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert History</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 60 }} />
      ) : alerts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          <Text style={styles.emptyTitle}>No Alerts Yet</Text>
          <Text style={styles.emptySub}>You haven't triggered any SOS alerts. Stay safe! 💜</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          renderItem={renderAlert}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  list: { padding: Spacing.lg, gap: Spacing.sm },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder, borderLeftWidth: 4, gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  badgeText: { fontSize: 10, fontWeight: Typography.fontWeightBold },
  trigger: { fontSize: Typography.fontSizeXS, color: Colors.textMuted, fontWeight: Typography.fontWeightSemibold },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, marginLeft: 'auto' },
  statusText: { fontSize: 10, fontWeight: Typography.fontWeightBold },
  time: { fontSize: Typography.fontSizeXS, color: Colors.textMuted },
  location: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary },
  message: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary, fontStyle: 'italic' },
  aiNote: { fontSize: Typography.fontSizeXS, color: Colors.primary },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: Spacing.xl },
  emptyTitle: { fontSize: Typography.fontSize2XL, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  emptySub: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
