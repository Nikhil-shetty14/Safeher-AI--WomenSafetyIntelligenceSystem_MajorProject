import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminAPI } from './api';

interface AuthCtx {
  user: any; token: string | null; isAdmin: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin_token');
    const u = localStorage.getItem('admin_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await adminAPI.login(email, pass);
    if (res.data.user?.role !== 'admin') throw new Error('Admin access required');
    localStorage.setItem('admin_token', res.data.access_token);
    localStorage.setItem('admin_user', JSON.stringify(res.data.user));
    setToken(res.data.access_token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, isAdmin: !!user && user.role === 'admin', login, logout }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAdminAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return c;
};
