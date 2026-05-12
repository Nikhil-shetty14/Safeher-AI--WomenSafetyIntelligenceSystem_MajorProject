import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Map as MapIcon, Users, Settings, 
  LogOut, Shield, ShieldCheck, Bell, Activity
} from 'lucide-react';
import { useAdminAuth } from './AuthContext';

export default function Sidebar() {
  const { logout, user } = useAdminAuth();

  return (
    <div style={s.sidebar}>
      {/* Brand */}
      <div style={s.brand}>
        <div style={s.logoCircle}>
          <ShieldCheck size={28} color="#fff" />
        </div>
        <div>
          <h2 style={s.brandTitle}>SafeHer AI</h2>
          <p style={s.brandSub}>Command Console</p>
        </div>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '0 20px 20px' }} />

      {/* Navigation */}
      <div style={s.navGroup}>
        <p style={s.navLabel}>Primary Monitoring</p>
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/map" icon={MapIcon} label="Live Tactical Map" />
        <NavItem to="/users" icon={Users} label="Personnel Registry" />
        <NavItem to="/alerts" icon={Bell} label="Emergency Alerts" />
      </div>

      <div style={s.navGroup}>
        <p style={s.navLabel}>System Controls</p>
        <NavItem to="/analytics" icon={Activity} label="System Analytics" />
        <NavItem to="/settings" icon={Settings} label="Console Settings" />
      </div>

      {/* User Info & Logout */}
      <div style={s.footer}>
        <div style={s.userCard}>
          <div style={s.avatar}>{user?.name?.[0] || 'A'}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p style={s.userName}>{user?.name || 'Administrator'}</p>
            <p style={s.userRole}>Level 1 Operator</p>
          </div>
        </div>
        <button onClick={logout} style={s.logoutBtn}>
          <LogOut size={18} /> <span>Terminate Session</span>
        </button>
      </div>
    </div>
  );
}

const NavItem = ({ to, icon: Icon, label }: any) => (
  <NavLink 
    to={to} 
    style={({ isActive }) => ({
      ...s.navItem,
      background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
      color: isActive ? '#fff' : '#94a3b8',
      borderLeft: isActive ? '3px solid #8b5cf6' : '3px solid transparent',
    })}
  >
    <Icon size={20} />
    <span style={{ marginLeft: '12px', fontWeight: 600 }}>{label}</span>
  </NavLink>
);

const s: Record<string, React.CSSProperties> = {
  sidebar: { 
    width: '280px', height: '100vh', background: 'var(--bg-panel)', 
    borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
    position: 'relative', zIndex: 100
  },
  brand: { padding: '32px 24px', display: 'flex', alignItems: 'center', gap: '12px' },
  logoCircle: { 
    width: '44px', height: '44px', borderRadius: '12px', background: '#8b5cf6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 15px rgba(139,92,246,0.5)'
  },
  brandTitle: { fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' },
  brandSub: { fontSize: '11px', color: '#8b5cf6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' },
  navGroup: { padding: '0 12px', marginBottom: '24px' },
  navLabel: { fontSize: '10px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginLeft: '12px' },
  navItem: { 
    display: 'flex', alignItems: 'center', padding: '12px 16px', borderRadius: '0 8px 8px 0',
    marginBottom: '4px', textDecoration: 'none', transition: 'all 0.2s'
  },
  footer: { marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border)' },
  userCard: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  avatar: { 
    width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#8b5cf6',
    border: '1px solid var(--border)'
  },
  userName: { fontSize: '14px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: '11px', color: '#64748b' },
  logoutBtn: { 
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    padding: '10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)',
    background: 'rgba(239,68,68,0.05)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 700
  },
};
