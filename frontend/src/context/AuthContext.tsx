import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/client';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  profile_image?: string;
  age?: number;
  gender?: string;
  address?: string;
  blood_group?: string;
  medical_conditions?: string;
  allergies?: string;
  safety_preferences?: any;
  notification_settings?: any;
  security_settings?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  verifyOTP: (sessionId: string, code: string) => Promise<any>;
  resendOTP: (sessionId: string) => Promise<any>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem('safeher_token'),
        AsyncStorage.getItem('safeher_user'),
      ]);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, password: string) => {
    const res = await authAPI.login({ phone, password });
    if (res.data.status === '2fa_pending') {
      return res.data;
    }
    const { access_token, user: userData } = res.data;
    await AsyncStorage.setItem('safeher_token', access_token);
    await AsyncStorage.setItem('safeher_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return res.data;
  };

  const register = async (data: any) => {
    const res = await authAPI.register(data);
    if (res.data.status === '2fa_pending') {
      return res.data;
    }
    const { access_token, user: userData } = res.data;
    await AsyncStorage.setItem('safeher_token', access_token);
    await AsyncStorage.setItem('safeher_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return res.data;
  };

  const verifyOTP = async (sessionId: string, code: string) => {
    const res = await authAPI.verifyOTP({ session_id: sessionId, code });
    const { access_token, user: userData } = res.data;
    await AsyncStorage.setItem('safeher_token', access_token);
    await AsyncStorage.setItem('safeher_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return res.data;
  };

  const resendOTP = async (sessionId: string) => {
    const res = await authAPI.resendOTP({ session_id: sessionId });
    return res.data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch { }
    await AsyncStorage.multiRemove(['safeher_token', 'safeher_user']);
    setToken(null);
    setUser(null);
  };

  const updateUser = useCallback(async (data: Partial<User>) => {
    setUser((prev) => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) {
        AsyncStorage.setItem('safeher_user', JSON.stringify(updated));
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!token,
      login, register, verifyOTP, resendOTP, logout, updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
