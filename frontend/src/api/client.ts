import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_HOST = 'http://10.165.16.100:8000';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_HOST;
console.log('SafeHer API host:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // Increased timeout for slow mobile networks
});

// Attach JWT token to every request and log requests
api.interceptors.request.use(async (config) => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  const token = await AsyncStorage.getItem('safeher_token');
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else if (config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
}, (error) => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

// Handle token expiry, logging, and retry logic
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    console.error(`[API Error] ${config?.method?.toUpperCase()} ${config?.url} | Status: ${err.response?.status} | Message: ${err.message} | Response:`, err.response?.data);
    
    // Auto-retry once for network errors or timeouts (no response from server)
    if (!err.response && config && !config._retryCount) {
      config._retryCount = 1;
      console.log(`[API Retry] Retrying request ${config.baseURL}${config.url} due to network issue...`);
      return new Promise(resolve => setTimeout(() => resolve(api(config)), 2000));
    }

    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('safeher_token');
      await AsyncStorage.removeItem('safeher_user');
    }
    return Promise.reject(err);
  }
);

// Helper for robust multipart file uploads in React Native (bypassing Axios boundary bugs)
const uploadMultipart = async (urlPath: string, formData: FormData) => {
  try {
    console.log(`[API Upload Request] POST ${BASE_URL}${urlPath}`);
    const token = await AsyncStorage.getItem('safeher_token');
    const response = await fetch(`${BASE_URL}${urlPath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
    },
      body: formData,
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error: any = new Error(data.error || `Upload failed with status ${response.status}`);
      error.response = { data };
      throw error;
    }
    return { data, status: response.status };
  } catch (err: any) {
    console.error(`[API Upload Error] POST ${BASE_URL}${urlPath} | Message: ${err.message}`);
    if (!err.response) {
      err.response = { data: { error: err.message } };
    }
    throw err;
  }
};

// ─── Health Check ─────────────────────────────────────
export const healthAPI = {
  check: async () => {
    try {
      console.log(`[Network Health Check] Pinging ${BASE_URL}/health ...`);
      const res = await api.get('/health', { timeout: 5000 });
      console.log(`[Network Health Check] Success:`, res.data);
      return true;
    } catch (err: any) {
      console.error(`[Network Health Check] Failed to reach backend at ${BASE_URL}. Is the server running and on the same WiFi? Error:`, err.message);
      return false;
    }
  }
};

// ─── Auth ─────────────────────────────────────────────
export const authAPI = {
  register: (data: any) => api.post('/api/auth/register', data),
  login: (data: any) => api.post('/api/auth/login', data),
  verifyOTP: (data: { session_id: string; code: string }) => api.post('/api/auth/verify-otp', data),
  resendOTP: (data: { session_id: string }) => api.post('/api/auth/resend-otp', data),
  forgotPassword: (data: { phone: string }) => api.post('/api/auth/forgot-password', data),
  resetPassword: (data: { session_id: string; otp_code: string; new_password: string }) => api.post('/api/auth/reset-password', data),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data: any) => api.put('/api/auth/me', data),
  logout: () => api.post('/api/auth/logout'),
};

// ─── SOS ──────────────────────────────────────────────
export const sosAPI = {
  trigger: (data: any) => api.post('/api/sos/trigger', data),
  triggerWithVoice: (formData: FormData) =>
    uploadMultipart('/api/sos/trigger-voice', formData),
  getMyAlerts: (skip = 0, limit = 20) =>
    api.get(`/api/sos/my-alerts?skip=${skip}&limit=${limit}`),
  resolveAlert: (alertId: string) => api.patch(`/api/sos/${alertId}/resolve`),
  resolve: (alertId: string) => api.patch(`/api/sos/${alertId}/resolve`),
};

// ─── Contacts ─────────────────────────────────────────
export const contactsAPI = {
  getAll: () => api.get('/api/contacts'),
  add: (data: any) => api.post('/api/contacts', data),
  update: (id: string, data: any) => api.put(`/api/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/contacts/${id}`),
};

// ─── AI ───────────────────────────────────────────────
export const aiAPI = {
  analyzeText: (data: any) => api.post('/api/ai/analyze-text', data),
  analyzeVoice: (formData: FormData) =>
    uploadMultipart('/api/ai/analyze-voice', formData),
  chat: (message: string, sessionId?: string) =>
    api.post('/api/ai/chat', { message, session_id: sessionId }),
  // Retrieves area risk with validation and fallback
  getAreaRisk: async (lat: number, lng: number) => {
    console.log(`[AreaRisk] Validating coordinates: lat=${lat}, lng=${lng}`);
    if (typeof lat !== 'number' || typeof lng !== 'number' ||
        Number.isNaN(lat) || Number.isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
        (lat === 0 && lng === 0)) {
      console.warn(`[AreaRisk] Invalid coordinates detected. Returning safe fallback.`);
      return {
        data: {
          risk_level: 'medium',
          confidence: 0.5,
          factors: ['Location unavailable or invalid. Defaulting to standard precautions.'],
          recommendation: 'Stay alert and maintain situational awareness.'
        }
      };
    }
    console.log(`[AreaRisk] Requesting data from backend for lat=${lat}, lng=${lng}`);
    try {
      const response = await api.get(`/api/ai/area-risk?latitude=${lat}&longitude=${lng}`);
      console.log(`[AreaRisk] Successfully fetched risk data`);
      return response;
    } catch (networkError: any) {
      console.error(`[AreaRisk] Network request failed. Retrying...`, networkError.message);
      try {
        const retryResponse = await api.get(`/api/ai/area-risk?latitude=${lat}&longitude=${lng}`, { timeout: 20000 });
        console.log(`[AreaRisk] Retry succeeded`);
        return retryResponse;
      } catch (retryError: any) {
        console.error(`[AreaRisk] Retry failed. Returning fallback.`, retryError.message);
        return {
          data: {
            risk_level: 'medium',
            confidence: 0.5,
            factors: ['Network connection failed.', 'Unable to reach SafeHer AI for real-time analysis.'],
            recommendation: 'Maintain standard precautions until connection is restored.'
          }
        };
      }
    }
  },
  // New endpoint to fetch AI‑ranked nearby services
  getNearbyServices: (lat: number, lng: number) => api.get(`/api/ai/nearby-services?latitude=${lat}&longitude=${lng}`),
  getPredictionHistory: () => api.get('/api/ai/predictions/history'),
  predictRouteSafety: (data: any) => api.post('/api/ai/predict-route-safety', data),
};

// ─── Location ─────────────────────────────────────────
export const locationAPI = {
  update: (data: any) => api.post('/api/location/update', data),
  getHistory: (hours = 24) => api.get(`/api/location/history?hours=${hours}`),
  sosLive: (data: any) => api.post('/api/location/sos-live', data),
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
    uploadMultipart('/api/profile/upload-photo', formData),
  getHistorySummary: () => api.get('/api/profile/history/summary'),
};

// ─── Complaints ───────────────────────────────────────
export const complaintsAPI = {
  submit: (formData: FormData) => uploadMultipart('/api/complaints/submit', formData),
  getMyComplaints: () => api.get('/api/complaints/my-complaints'),
};

// ─── Broadcasts ───────────────────────────────────────
export const broadcastAPI = {
  getActive: () => api.get('/api/broadcast/active'),
  getMyNotifications: () => api.get('/api/broadcast/my-notifications'),
  markAsRead: (id: string) => api.post(`/api/broadcast/${id}/read`),
};

export default api;
