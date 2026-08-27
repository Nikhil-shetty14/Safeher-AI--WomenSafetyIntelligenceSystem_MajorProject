import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../context/SocketContext';
import { broadcastAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';

export default function BroadcastModal() {
  const { broadcasts, clearBroadcast } = useSocket();
  const [currentBroadcast, setCurrentBroadcast] = useState<any>(null);

  useEffect(() => {
    if (broadcasts.length > 0 && !currentBroadcast) {
      setCurrentBroadcast(broadcasts[0]);
    }
  }, [broadcasts, currentBroadcast]);

  useEffect(() => {
    // Check for missed active broadcasts on mount
    const fetchActive = async () => {
      try {
        const res = await broadcastAPI.getActive();
        // Just set the most recent one if it exists
        if (res.data && res.data.length > 0 && !currentBroadcast) {
          setCurrentBroadcast(res.data[0]);
        }
      } catch (err) {
        console.warn('Failed to fetch active broadcasts', err);
      }
    };
    fetchActive();
  }, []);

  const handleDismiss = async () => {
    if (!currentBroadcast) return;
    
    // Mark as read in backend
    try {
      await broadcastAPI.markAsRead(currentBroadcast._id || currentBroadcast.id);
    } catch (e) {
      console.warn("Failed to mark broadcast as read", e);
    }

    // Clear from socket state
    clearBroadcast(currentBroadcast._id || currentBroadcast.id);
    setCurrentBroadcast(null);

    // If there are more in the queue, show the next one
    if (broadcasts.length > 1) {
      setCurrentBroadcast(broadcasts[1]);
    }
  };

  if (!currentBroadcast) return null;

  const isCritical = currentBroadcast.priority === 'critical';
  const headerColor = isCritical ? Colors.danger : Colors.warning;
  const icon = currentBroadcast.type === 'weather' ? 'partly-sunny' 
             : currentBroadcast.type === 'missing' ? 'search' 
             : currentBroadcast.type === 'instruction' ? 'information-circle'
             : 'warning';

  return (
    <Modal transparent animationType="slide" visible={!!currentBroadcast}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { borderColor: headerColor }]}>
          <View style={[styles.header, { backgroundColor: headerColor }]}>
            <Ionicons name={icon as any} size={24} color="#fff" />
            <Text style={styles.headerTitle}>
              {currentBroadcast.priority.toUpperCase()} {currentBroadcast.type.toUpperCase()}
            </Text>
          </View>
          
          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.title}>{currentBroadcast.title}</Text>
            <Text style={styles.body}>{currentBroadcast.body}</Text>
            
            {currentBroadcast.target_location && (
              <View style={styles.locationTag}>
                <Ionicons name="location" size={12} color={Colors.textSecondary} />
                <Text style={styles.locationText}>Target: {currentBroadcast.target_location}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: headerColor }]} 
              onPress={handleDismiss}
            >
              <Text style={styles.buttonText}>I UNDERSTAND</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerTitle: {
    color: '#fff',
    fontSize: Typography.fontSizeLG,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 1,
  },
  content: {
    padding: Spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  button: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: Typography.fontWeightBold,
    fontSize: 16,
  },
});
