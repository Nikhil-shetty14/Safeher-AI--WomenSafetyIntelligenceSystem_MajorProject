import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('admin_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const adminAPI = {
  login: (identifier: string, password: string) =>
    api.post('/api/admin/login', { identifier, password }),
  getStats: () => api.get('/api/admin/stats'),
  getRecentAlerts: (limit = 50) =>
    api.get(`/api/admin/alerts/recent?limit=${limit}`),
  getUsers: (skip = 0, limit = 50) =>
    api.get(`/api/admin/users?skip=${skip}&limit=${limit}`),
  updateUser: (id: string, data: any) => 
    api.put(`/api/admin/users/${id}`, data),
  getLiveUsers: () => api.get('/api/admin/live-users'),
  getActiveAlerts: () => api.get('/api/admin/alerts/active'),
  getHeatmap: () => api.get('/api/admin/alerts/heatmap'),
  getDangerTrends: () => api.get('/api/admin/analytics/danger-trends'),
  getPredictiveIntel: () => api.get('/api/admin/analytics/predictive-intel'),
  resolveAlert: (id: string) => api.patch(`/api/sos/${id}/resolve`),
  deleteAlert: (id: string) => api.delete(`/api/admin/alerts/${id}`),
  getAlertIntelligence: (id: string) => api.get(`/api/admin/alerts/${id}/intelligence`),
  getComplaints: () => api.get('/api/complaints/admin/all'),
  updateComplaint: (id: string, data: any) => api.patch(`/api/complaints/admin/${id}`, data),
  deleteComplaint: (id: string) => api.delete(`/api/complaints/admin/${id}`),
  createAdmin: (data: any) => api.post('/api/admin/management/create', data),
  listAdmins: () => api.get('/api/admin/management/list'),
  changeAdminStatus: (id: string, active: boolean) => api.put(`/api/admin/management/${id}/status?active=${active}`),
  resetAdminPassword: (id: string, new_password: string) => api.put(`/api/admin/management/${id}/reset-password`, { new_password }),
  deleteAdmin: (id: string) => api.delete(`/api/admin/management/${id}`),
  getAdminLogs: (limit = 100) => api.get(`/api/admin/management/logs?limit=${limit}`),
  changePassword: (data: any) => api.post('/api/admin/change-password', data),
  getStatePerformance: () => api.get('/api/state/performance'),
  getStateRankings: () => api.get('/api/state/rankings'),
  getStateEscalations: () => api.get('/api/state/escalations'),
  generateSystemReport: () => api.get('/api/reports/generate', { responseType: 'blob' }),
};

export const broadcastAPI = {
  create: (data: any) => api.post('/api/broadcast/', data),
  getHistory: (skip = 0, limit = 50) => api.get(`/api/broadcast/?skip=${skip}&limit=${limit}`),
  delete: (id: string) => api.delete(`/api/broadcast/${id}`),
};

export const profileAPI = {
  getProfile: () => api.get('/api/profile/me'),
  updateProfile: (data: any) => api.put('/api/profile/update', data),
  updateSecuritySettings: (data: any) => api.put('/api/profile/preferences/security', data),
  updateNotificationSettings: (data: any) => api.put('/api/profile/preferences/notifications', data),
  getHistorySummary: () => api.get('/api/profile/history/summary'),
};

export default api;
