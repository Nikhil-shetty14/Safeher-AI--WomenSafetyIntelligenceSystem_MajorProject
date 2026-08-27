import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { aiAPI } from '../api/client';
import * as Location from 'expo-location';

export default function AIIntelligenceScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Use useRef so the Animated.Value persists across re-renders
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAIIntelligence();
  }, []);

  const fetchAIIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 12.9716;
      let lng = 77.5946;

      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch (locErr) {
          console.warn('[AIIntelligence] Could not get location, using default:', locErr);
        }
      }

      // Call the real backend API
      const response = await aiAPI.getAreaRisk(lat, lng);
      const data = response.data;

      // Map backend response to display-friendly format
      const riskLevel = (data.risk_level || 'medium').toUpperCase();
      const confidence = Math.round((data.confidence || 0.5) * 100);
      
      // Calculate risk score from level
      let riskScore = 50;
      if (riskLevel === 'LOW' || riskLevel === 'SAFE') riskScore = 25;
      else if (riskLevel === 'MEDIUM') riskScore = 55;
      else if (riskLevel === 'HIGH') riskScore = 78;
      else if (riskLevel === 'CRITICAL') riskScore = 92;

      // Build hotspots from factors
      const factors = data.factors || [];
      const hotspots = factors.slice(0, 3).map((factor: string, idx: number) => {
        const risk = idx === 0 ? (riskScore > 70 ? 'HIGH' : 'MEDIUM') : (idx === 1 ? 'MEDIUM' : 'LOW');
        return {
          name: factor.length > 40 ? factor.substring(0, 40) + '...' : factor,
          risk,
          type: 'AI Detected Factor',
        };
      });

      // Build insights
      const insights = [
        data.recommendation || 'Stay alert and maintain situational awareness.',
        ...(factors.length > 3 ? factors.slice(3, 5) : []),
      ].filter(Boolean);

      // Map threat level
      let threatLevel = 'NORMAL';
      if (riskLevel === 'HIGH') threatLevel = 'ELEVATED';
      else if (riskLevel === 'CRITICAL') threatLevel = 'CRITICAL';
      else if (riskLevel === 'MEDIUM') threatLevel = 'MODERATE';
      else if (riskLevel === 'LOW' || riskLevel === 'SAFE') threatLevel = 'NORMAL';

      setRiskData({
        threatLevel,
        riskScore,
        confidence,
        tacticalSummary: data.recommendation || 'AI analysis complete. Stay aware of your surroundings and follow recommended safety precautions.',
        hotspots: hotspots.length > 0 ? hotspots : [
          { name: 'No specific threats detected', risk: 'LOW', type: 'All Clear' }
        ],
        insights: insights.length > 0 ? insights : [
          'No significant risk factors detected in your area.',
        ],
      });

      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    } catch (err: any) {
      console.error('[AIIntelligence] Error fetching data:', err.message);
      setError('Failed to load AI Intelligence. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Ollama AI Analyzing Environment...</Text>
        <Text style={styles.loadingSubText}>Scanning area risk factors</Text>
      </View>
    );
  }

  if (error || !riskData) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cloud-offline" size={48} color={Colors.danger} />
        <Text style={styles.errorText}>{error || 'Unable to load AI data'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchAIIntelligence}>
          <Ionicons name="refresh" size={18} color={Colors.white} />
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtnAlt} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getRiskColor = (score: number) => {
    if (score < 40) return Colors.success;
    if (score < 75) return Colors.warning;
    return Colors.danger;
  };

  const riskColor = getRiskColor(riskData.riskScore);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Intelligence Center</Text>
        <TouchableOpacity onPress={fetchAIIntelligence}>
          <Ionicons name="refresh" size={22} color={Colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={{ opacity: fadeAnim }}>
          
          <View style={styles.mainScoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <Text style={styles.scoreTitle}>Area Risk Score</Text>
                <Text style={styles.scoreSubtitle}>Powered by Ollama</Text>
              </View>
              <View style={styles.badgeWrapper}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
                <Text style={styles.badgeText}>AI Verified</Text>
              </View>
            </View>
            
            <View style={styles.scoreCircleWrapper}>
              <View style={[styles.scoreCircle, { borderColor: riskColor }]}>
                <Text style={[styles.scoreNumber, { color: riskColor }]}>{riskData.riskScore}</Text>
                <Text style={styles.scoreTotal}>/ 100</Text>
              </View>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Threat Level</Text>
                <Text style={[styles.statValue, { color: riskColor }]}>{riskData.threatLevel}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>AI Confidence</Text>
                <Text style={styles.statValue}>{riskData.confidence}%</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tactical Summary</Text>
            <View style={styles.tacticalCard}>
              <Ionicons name="analytics" size={20} color={Colors.primary} style={styles.tacticalIcon} />
              <Text style={styles.tacticalText}>{riskData.tacticalSummary}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Risk Factors Near You</Text>
            {riskData.hotspots.map((spot: any, index: number) => (
              <View key={index} style={styles.hotspotCard}>
                <View style={styles.hotspotLeft}>
                  <Ionicons name="warning" size={20} color={spot.risk === 'HIGH' ? Colors.danger : spot.risk === 'MEDIUM' ? Colors.warning : Colors.success} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.hotspotName}>{spot.name}</Text>
                    <Text style={styles.hotspotType}>{spot.type}</Text>
                  </View>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: spot.risk === 'HIGH' ? Colors.danger + '20' : spot.risk === 'MEDIUM' ? Colors.warning + '20' : Colors.success + '20' }]}>
                  <Text style={[styles.riskBadgeText, { color: spot.risk === 'HIGH' ? Colors.danger : spot.risk === 'MEDIUM' ? Colors.warning : Colors.success }]}>{spot.risk}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Generated Insights</Text>
            {riskData.insights.map((insight: string, index: number) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
  loadingText: { marginTop: 16, color: Colors.primaryLight, fontSize: 16, fontWeight: '600' },
  loadingSubText: { marginTop: 8, color: Colors.textMuted, fontSize: 13 },
  
  errorText: { marginTop: 16, color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.lg, marginTop: 20 },
  retryText: { color: Colors.white, fontSize: 15, fontWeight: '700', marginLeft: 8 },
  backBtnAlt: { marginTop: 12, paddingVertical: 10 },
  backBtnText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: 20,
    backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  
  mainScoreCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, ...Shadows.card, marginBottom: Spacing.xl
  },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  scoreSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 4, fontWeight: '600' },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '800', color: Colors.success, marginLeft: 4 },
  
  scoreCircleWrapper: { alignItems: 'center', marginVertical: Spacing.xl },
  scoreCircle: { 
    width: 140, height: 140, borderRadius: 70, borderWidth: 8, 
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row' 
  },
  scoreNumber: { fontSize: 48, fontWeight: '900' },
  scoreTotal: { fontSize: 16, color: Colors.textMuted, fontWeight: '700', marginTop: 24, marginLeft: 4 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: Colors.backgroundSecondary, padding: 12, borderRadius: BorderRadius.lg },
  statBox: { alignItems: 'center' },
  statLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.cardBorder },
  
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  tacticalCard: { backgroundColor: Colors.primary + '10', padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.primary + '30', flexDirection: 'row', alignItems: 'flex-start' },
  tacticalIcon: { marginRight: 12, marginTop: 2 },
  tacticalText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  
  hotspotCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  hotspotLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  hotspotName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  hotspotType: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  riskBadgeText: { fontSize: 10, fontWeight: '800' },
  
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  insightDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primaryLight, marginTop: 6, marginRight: 12 },
  insightText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
});
