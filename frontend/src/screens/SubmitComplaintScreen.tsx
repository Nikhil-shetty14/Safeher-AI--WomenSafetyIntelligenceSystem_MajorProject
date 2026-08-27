import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { complaintsAPI } from '../api/client';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

export default function SubmitComplaintScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    state: '',
    district: '',
    taluk: '',
    address: '',
    title: '',
    description: '',
  });
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [media, setMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to capture GPS.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  const handlePickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setMedia(prev => [...prev, ...result.assets]);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.state || !form.district) {
      Alert.alert('Error', 'Please fill in the required fields (State, District, Title, Description).');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('state', form.state);
      formData.append('district', form.district);
      formData.append('taluk', form.taluk);
      formData.append('address', form.address);
      formData.append('title', form.title);
      formData.append('description', form.description);
      if (location) {
        formData.append('latitude', location.coords.latitude.toString());
        formData.append('longitude', location.coords.longitude.toString());
      }

      media.forEach((item, index) => {
        const uri = Platform.OS === 'ios' ? item.uri.replace('file://', '') : item.uri;
        const name = item.fileName || `media_${index}.jpg`;
        const type = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        formData.append('files', {
          uri,
          name,
          type
        } as any);
      });

      await complaintsAPI.submit(formData);
      Alert.alert('Success', 'Your complaint has been submitted successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>File a Complaint</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Complaint Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="E.g., Harassment at bus stop"
            placeholderTextColor={Colors.textMuted}
            value={form.title}
            onChangeText={t => setForm({ ...form, title: t })}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>State *</Text>
            <TextInput
              style={styles.input}
              placeholder="State"
              placeholderTextColor={Colors.textMuted}
              value={form.state}
              onChangeText={t => setForm({ ...form, state: t })}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>District *</Text>
            <TextInput
              style={styles.input}
              placeholder="District"
              placeholderTextColor={Colors.textMuted}
              value={form.district}
              onChangeText={t => setForm({ ...form, district: t })}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Taluk</Text>
          <TextInput
            style={styles.input}
            placeholder="Taluk"
            placeholderTextColor={Colors.textMuted}
            value={form.taluk}
            onChangeText={t => setForm({ ...form, taluk: t })}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Exact Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter full address"
            placeholderTextColor={Colors.textMuted}
            value={form.address}
            onChangeText={t => setForm({ ...form, address: t })}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the incident..."
            placeholderTextColor={Colors.textMuted}
            value={form.description}
            onChangeText={t => setForm({ ...form, description: t })}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Evidence (Images/Videos/Audio)</Text>
          <ScrollView horizontal style={styles.mediaPreview}>
            {media.map((m, i) => (
              <View key={i} style={styles.mediaItem}>
                <Image source={{ uri: m.uri }} style={styles.mediaImage} />
                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => removeMedia(i)}>
                  <Ionicons name="close-circle" size={24} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addMediaBtn} onPress={handlePickMedia}>
              <Ionicons name="add-circle" size={32} color={Colors.primaryLight} />
              <Text style={{ color: Colors.primaryLight, fontSize: 12, marginTop: 4 }}>Add Media</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.locationBox}>
          <Ionicons name="location" size={20} color={Colors.primary} />
          <Text style={styles.locationText}>
            GPS Captured: {location ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` : 'Fetching...'}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitBtnText}>SUBMIT COMPLAINT</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: { padding: Spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  formGroup: { marginBottom: Spacing.lg },
  label: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    backgroundColor: Colors.backgroundSecondary, color: Colors.white,
    borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: BorderRadius.md,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  mediaPreview: { flexDirection: 'row', marginTop: 8 },
  mediaItem: { marginRight: 12, position: 'relative' },
  mediaImage: { width: 80, height: 80, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundSecondary },
  removeMediaBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: Colors.background, borderRadius: 12 },
  addMediaBtn: {
    width: 80, height: 80, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.primaryLight,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },
  locationBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '20',
    padding: 12, borderRadius: BorderRadius.md, marginBottom: 24,
  },
  locationText: { color: Colors.primaryLight, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: BorderRadius.md, alignItems: 'center'
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
