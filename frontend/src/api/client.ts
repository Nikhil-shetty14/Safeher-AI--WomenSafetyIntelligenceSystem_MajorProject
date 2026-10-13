import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_HOST = 'http://10.47.178.100:8000';

export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || DEFAULT_API_HOST;
console.log('SafeHer API host:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000, // Generous timeout for endpoints that call local LLMs (Ollama phi3)
});

// ─── Auth State Sync ──────────────────────────────────
// Allows AuthContext to register its logout callback so the 401 interceptor
// can properly reset React state (user/token), not just clear AsyncStorage.
let _onAuthExpired: (() => void) | null = null;

export const setAuthExpiredCallback = (callback: () => void) => {
  _onAuthExpired = callback;
};

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
      // Don't auto-logout on auth endpoints (login/register/verify) — those 401s
      // are credential errors, not expired-token errors.
      const isAuthEndpoint = config?.url?.includes('/api/auth/login') ||
                             config?.url?.includes('/api/auth/register') ||
                             config?.url?.includes('/api/auth/verify-otp');
      if (!isAuthEndpoint) {
        console.warn('[API] 401 on protected route — clearing auth state and forcing re-login');
        await AsyncStorage.multiRemove(['safeher_token', 'safeher_user']);
        if (_onAuthExpired) {
          _onAuthExpired();
        }
      }
    }
    return Promise.reject(err);
  }
);

// Helper for robust multipart file uploads in React Native.
// Uses XMLHttpRequest instead of fetch because RN's fetch does NOT support
// the { uri, name, type } FormDataPart pattern, while RN's XHR polyfill does.
const uploadMultipart = (urlPath: string, formData: FormData): Promise<{ data: any; status: number }> => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[API Upload Request] POST ${BASE_URL}${urlPath}`);
      const token = await AsyncStorage.getItem('safeher_token');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}${urlPath}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      // Do NOT set Content-Type — XHR will set multipart/form-data with the correct boundary automatically.
      xhr.timeout = 30000;

      xhr.onload = () => {
        let data: any = {};
        try { data = JSON.parse(xhr.responseText); } catch (_) {}

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ data, status: xhr.status });
        } else {
          const error: any = new Error(data.error || `Upload failed with status ${xhr.status}`);
          error.response = { data };
          reject(error);
        }
      };

      xhr.onerror = () => {
        const error: any = new Error('Network request failed');
        error.response = { data: { error: 'Network request failed' } };
        reject(error);
      };

      xhr.ontimeout = () => {
        const error: any = new Error('Upload timed out');
        error.response = { data: { error: 'Upload timed out' } };
        reject(error);
      };

      xhr.send(formData);
    } catch (err: any) {
      console.error(`[API Upload Error] POST ${BASE_URL}${urlPath} | Message: ${err.message}`);
      if (!err.response) {
        err.response = { data: { error: err.message } };
      }
      reject(err);
    }
  });
};

// Automatic network retry with exponential backoff for critical uploads
const uploadMultipartWithRetry = async (urlPath: string, formData: FormData, maxRetries = 2): Promise<{ data: any; status: number }> => {
  let lastError: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await uploadMultipart(urlPath, formData);
    } catch (err: any) {
      lastError = err;
      console.warn(`[API Upload Retry] Attempt ${attempt + 1} failed for ${urlPath}: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
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
  trigger: async (data: any, retries = 2) => {
    let lastErr: any = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await api.post('/api/sos/trigger', data);
      } catch (err: any) {
        lastErr = err;
        console.warn(`[SOS Trigger Retry] Attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
    }
    throw lastErr;
  },
  triggerWithVoice: (formData: FormData) =>
    uploadMultipartWithRetry('/api/sos/trigger-voice', formData),
  getMyAlerts: (skip = 0, limit = 20) =>
    api.get(`/api/sos/my-alerts?skip=${skip}&limit=${limit}`),
  resolveAlert: (alertId: string) => api.patch(`/api/sos/${alertId}/resolve`),
  resolve: (alertId: string) => api.patch(`/api/sos/${alertId}/resolve`),
  uploadPhotoEvidence: (formData: FormData) =>
    uploadMultipartWithRetry('/api/sos/upload-evidence', formData),
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
        const retryResponse = await api.get(`/api/ai/area-risk?latitude=${lat}&longitude=${lng}`, { timeout: 6000 });
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
  predictiveGuardian: (data: any) => api.post('/api/ai/predictive-guardian', data),
};

// ─── Location ─────────────────────────────────────────
export const locationAPI = {
  update: (data: any) => api.post('/api/location/update', data),
  getHistory: (hours = 24) => api.get(`/api/location/history?hours=${hours}`),
  sosLive: (data: any) => api.post('/api/location/sos-live', data),
  getHeatmap: () => api.get('/api/location/heatmap'),
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
