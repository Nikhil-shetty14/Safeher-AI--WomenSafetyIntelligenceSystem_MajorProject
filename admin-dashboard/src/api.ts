import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

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
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  getStats: () => api.get('/api/admin/stats'),
  getRecentAlerts: (limit = 50) =>
    api.get(`/api/admin/alerts/recent?limit=${limit}`),
  getUsers: (skip = 0, limit = 50) =>
    api.get(`/api/admin/users?skip=${skip}&limit=${limit}`),
  getLiveUsers: () => api.get('/api/admin/live-users'),
  getActiveAlerts: () => api.get('/api/admin/alerts/active'),
  getHeatmap: () => api.get('/api/admin/alerts/heatmap'),
  getDangerTrends: () => api.get('/api/admin/analytics/danger-trends'),
  resolveAlert: (id: string) => api.patch(`/api/sos/${id}/resolve`),
  deleteAlert: (id: string) => api.delete(`/api/admin/alerts/${id}`),
};

export default api;
