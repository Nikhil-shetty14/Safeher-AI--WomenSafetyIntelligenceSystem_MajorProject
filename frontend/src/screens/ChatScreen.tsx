import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Alert, Modal, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiAPI, sosAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { getSeverityColor } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import uuid from 'react-native-uuid';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  danger_level?: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'I feel unsafe right now',
  'Someone is following me',
  'Share safety tips',
  'How to use SOS?',
];

export default function ChatScreen() {
  const { user } = useAuth();
  const { emitSOS } = useSocket();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      content: "Hi! I'm SafeHer AI, your personal safety assistant. 💜\n\nHow are you feeling today? I'm here to help you stay safe and answer any safety questions.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [panicWord, setPanicWord] = useState('');
  const [newPanicWord, setNewPanicWord] = useState('');
  const [showPanicModal, setShowPanicModal] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    AsyncStorage.getItem('safeher_panic_word').then((w) => { if (w) setPanicWord(w); });
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');

    // ── PANIC WORD CHECK ──────────────────────────────
    if (panicWord && msg.toLowerCase().includes(panicWord.toLowerCase())) {
      Vibration.vibrate([0, 300, 200, 300]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let loc = null;
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          loc = pos.coords;
        }
        await sosAPI.trigger({
          user_id: user?.id,
          trigger_type: 'panic_word',
          location: { latitude: loc?.latitude || 0, longitude: loc?.longitude || 0 },
          message: `🔐 Panic word triggered silently via chat.`,
        });
        emitSOS({ latitude: loc?.latitude || 0, longitude: loc?.longitude || 0 }, 'high');
      } catch { }
      // Show normal response in chat — don't alert the attacker!
    }
    // ─────────────────────────────────────────────────

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);

    try {
      const res = await aiAPI.chat(msg, sessionId);
      setSessionId(res.data.session_id);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: res.data.reply,
        danger_level: res.data.danger_level,
        timestamp: new Date(),
      };
      setMessages((p) => [...p, aiMsg]);
    } catch {
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'I had trouble connecting. Please check your internet. In an emergency, call 112 immediately! 🆘',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const dangerColor = item.danger_level ? getSeverityColor(item.danger_level) : null;
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.white} />
          </View>
        )}
        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          dangerColor && !isUser && { borderLeftColor: dangerColor, borderLeftWidth: 3 },
        ]}>
          {item.danger_level && item.danger_level !== 'safe' && !isUser && (
            <View style={[styles.dangerTag, { backgroundColor: dangerColor + '25' }]}>
              <Ionicons name="warning" size={12} color={dangerColor} />
              <Text style={[styles.dangerTagText, { color: dangerColor }]}>
                {' '}{item.danger_level.toUpperCase()} RISK DETECTED
              </Text>
            </View>
          )}
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.content}</Text>
          <Text style={styles.timeText}>{item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botAvatar}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>SafeHer AI</Text>
            <Text style={styles.headerSub}>🟢 Online · Safety Assistant</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowPanicModal(true)} style={styles.panicWordBtn}>
          <Ionicons name="key" size={18} color={panicWord ? Colors.success : Colors.textMuted} />
          <Text style={[styles.panicWordLabel, { color: panicWord ? Colors.success : Colors.textMuted }]}>
            {panicWord ? '🔐 Set' : 'Panic Word'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick prompts */}
      <View style={styles.quickRow}>
        {QUICK_PROMPTS.map((q) => (
          <TouchableOpacity key={q} style={styles.quickChip} onPress={() => sendMessage(q)}>
            <Text style={styles.quickChipText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.white} />
          </View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}> SafeHer is thinking...</Text>
          </View>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message SafeHer AI..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Panic Word Modal */}
      <Modal visible={showPanicModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🔐 Secret Panic Word</Text>
            <Text style={styles.modalDesc}>
              Set a secret word. If you type it anywhere in the chat, SOS is silently triggered without
              alerting anyone nearby.
            </Text>
            {panicWord ? (
              <View style={styles.currentWord}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.currentWordText}>  Current: "{panicWord}"</Text>
              </View>
            ) : null}
            <TextInput
              style={styles.modalInput}
              placeholder="Enter your panic word (e.g. pizza)..."
              placeholderTextColor={Colors.textMuted}
              value={newPanicWord}
              onChangeText={setNewPanicWord}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={async () => {
                if (!newPanicWord.trim()) return;
                await AsyncStorage.setItem('safeher_panic_word', newPanicWord.trim());
                setPanicWord(newPanicWord.trim());
                setNewPanicWord('');
                setShowPanicModal(false);
                Alert.alert('✅ Panic Word Set', `"${newPanicWord.trim()}" is now your secret SOS trigger!`);
              }}
            >
              <Text style={styles.modalSaveBtnText}>Save Panic Word</Text>
            </TouchableOpacity>
            {panicWord ? (
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.removeItem('safeher_panic_word');
                  setPanicWord('');
                  setShowPanicModal(false);
                }}
              >
                <Text style={styles.modalRemove}>Remove Panic Word</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setShowPanicModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, paddingTop: 55, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  headerTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary },
  headerSub: { fontSize: Typography.fontSizeXS, color: Colors.success },
  quickRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.cardBorder,
  },
  quickChip: {
    backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  quickChipText: { color: Colors.primaryLight, fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightMedium },
  list: { padding: Spacing.md, gap: Spacing.md },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  bubble: {
    maxWidth: '78%', backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  bubbleUser: { backgroundColor: Colors.primary, borderColor: Colors.primaryDark },
  bubbleAI: {},
  dangerTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginBottom: 6 },
  dangerTagText: { fontSize: 9, fontWeight: '700' },
  bubbleText: { color: Colors.textPrimary, fontSize: Typography.fontSizeMD, lineHeight: 22 },
  bubbleTextUser: { color: Colors.white },
  timeText: { fontSize: 9, color: Colors.textMuted, marginTop: 6, textAlign: 'right' },
  typingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.md, paddingBottom: 8,
  },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    padding: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  typingText: { color: Colors.textMuted, fontSize: Typography.fontSizeSM },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder, backgroundColor: Colors.backgroundSecondary,
  },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary,
    fontSize: Typography.fontSizeMD, maxHeight: 120, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5,
  },
  sendBtnDisabled: { opacity: 0.4 },
  panicWordBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 8, backgroundColor: Colors.card },
  panicWordLabel: { fontSize: Typography.fontSizeXS, fontWeight: Typography.fontWeightSemibold },
  modalOverlay: { flex: 1, backgroundColor: '#00000090', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: Colors.backgroundSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, gap: Spacing.sm,
  },
  modalTitle: { fontSize: Typography.fontSizeLG, fontWeight: Typography.fontWeightBold, color: Colors.textPrimary, textAlign: 'center' },
  modalDesc: { fontSize: Typography.fontSizeSM, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  currentWord: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success + '20', padding: Spacing.sm, borderRadius: BorderRadius.sm },
  currentWordText: { color: Colors.success, fontWeight: Typography.fontWeightSemibold },
  modalInput: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md,
    color: Colors.textPrimary, fontSize: Typography.fontSizeMD, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.full, padding: Spacing.md, alignItems: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
  },
  modalSaveBtnText: { color: Colors.white, fontWeight: Typography.fontWeightBold, fontSize: Typography.fontSizeMD },
  modalRemove: { color: Colors.danger, textAlign: 'center', padding: Spacing.sm, fontWeight: Typography.fontWeightSemibold },
  modalCancel: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.sm },
});
