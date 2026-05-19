import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.126.101.100:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('safeher_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('safeher_token');
      await AsyncStorage.removeItem('safeher_user');
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────
export const authAPI = {
  register: (data: any) => api.post('/api/auth/register', data),
  login: (data: any) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data: any) => api.put('/api/auth/me', data),
  logout: () => api.post('/api/auth/logout'),
};

// ─── SOS ──────────────────────────────────────────────
export const sosAPI = {
  trigger: (data: any) => api.post('/api/sos/trigger', data),
  triggerWithVoice: (formData: FormData) =>
    api.post('/api/sos/trigger-voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data) => data,
    }),
  getMyAlerts: (skip = 0, limit = 20) =>
    api.get(`/api/sos/my-alerts?skip=${skip}&limit=${limit}`),
  resolveAlert: (alertId: string) => api.patch(`/api/sos/${alertId}/resolve`),
};

// ─── Contacts ─────────────────────────────────────────
export const contactsAPI = {
  getAll: () => api.get('/api/contacts/'),
  add: (data: any) => api.post('/api/contacts/', data),
  update: (id: string, data: any) => api.put(`/api/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/contacts/${id}`),
};

// ─── AI ───────────────────────────────────────────────
export const aiAPI = {
  analyzeText: (data: any) => api.post('/api/ai/analyze-text', data),
  analyzeVoice: (formData: FormData) =>
    api.post('/api/ai/analyze-voice', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data) => data,
    }),
  chat: (message: string, sessionId?: string) =>
    api.post('/api/ai/chat', { message, session_id: sessionId }),
  getAreaRisk: (lat: number, lng: number) =>
    api.get(`/api/ai/area-risk?latitude=${lat}&longitude=${lng}`),
  getPredictionHistory: () => api.get('/api/ai/predictions/history'),
  predictRouteSafety: (data: any) => api.post('/api/ai/predict-route-safety', data),
};

// ─── Location ─────────────────────────────────────────
export const locationAPI = {
  update: (data: any) => api.post('/api/location/update', data),
  getHistory: (hours = 24) => api.get(`/api/location/history?hours=${hours}`),
};

// ─── Admin ────────────────────────────────────────────
export const adminAPI = {
  getStats: () => api.get('/api/admin/stats'),
  getRecentAlerts: () => api.get('/api/admin/alerts/recent'),
  getUsers: () => api.get('/api/admin/users'),
  getHeatmap: () => api.get('/api/admin/alerts/heatmap'),
  getDangerTrends: () => api.get('/api/admin/analytics/danger-trends'),
};

// ─── Profile ──────────────────────────────────────────
export const profileAPI = {
  getMe: () => api.get('/api/profile/me'),
  update: (data: any) => api.put('/api/profile/update', data),
  updateSafety: (data: any) => api.put('/api/profile/preferences/safety', data),
  updateNotifications: (data: any) => api.put('/api/profile/preferences/notifications', data),
  updateSecurity: (data: any) => api.put('/api/profile/preferences/security', data),
  uploadPhoto: (formData: FormData) =>
    api.post('/api/profile/upload-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: (data) => data,
    }),
  getHistorySummary: () => api.get('/api/profile/history/summary'),
};

export default api;
