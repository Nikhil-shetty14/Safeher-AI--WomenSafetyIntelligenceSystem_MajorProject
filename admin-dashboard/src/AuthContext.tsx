import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminAPI } from './api';

interface AuthCtx {
  user: any; token: string | null; isAdmin: boolean;
  login: (identifier: string, pass: string) => Promise<any>;
  logout: () => void;
  completeLogin: (token: string, user: any) => void;
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

  const completeLogin = (t: string, u: any) => {
    localStorage.setItem('admin_token', t);
    localStorage.setItem('admin_user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const login = async (identifier: string, pass: string) => {
    const res = await adminAPI.login(identifier, pass);
    if (!['admin', 'super_admin', 'regional_admin', 'district_admin'].includes(res.data.user?.role)) throw new Error('Admin access required');
    
    if (res.data.user?.requires_password_change) {
      return res; // Skip setting local storage
    }
    
    completeLogin(res.data.access_token, res.data.user);
    return res;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, isAdmin: !!user && ['admin', 'super_admin', 'regional_admin', 'district_admin'].includes(user.role), login, logout, completeLogin }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAdminAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdminAuth must be inside AdminAuthProvider');
  return c;
};
