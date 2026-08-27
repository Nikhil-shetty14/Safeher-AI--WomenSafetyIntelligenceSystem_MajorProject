import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAdminAuth } from './AuthContext';
import { profileAPI, adminAPI } from './api';
import {
  User, Shield, Activity, Bell, FileText, Download,
  Settings, CheckCircle, Smartphone, Lock, AlertTriangle, MapPin
} from 'lucide-react';

export default function AdminProfilePage() {
  const { user: authUser } = useAdminAuth();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, statsRes, histRes] = await Promise.all([
        profileAPI.getProfile(),
        adminAPI.getStats(),
        profileAPI.getHistorySummary()
      ]);
      setProfile(profRes.data);
      setEditForm({ name: profRes.data.name, phone: profRes.data.phone });
      setStats(statsRes.data);
      setHistory(histRes.data);
    } catch (e) {
      console.error("Failed to load profile data", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateProfile = async () => {
    try {
      await profileAPI.updateProfile(editForm);
      setEditMode(false);
      loadData();
    } catch (e) {
      alert("Failed to update profile");
    }
  };

  const toggleSecurity = async (key: string) => {
    if (!profile) return;
    const newSettings = { ...profile.security_settings, [key]: !profile.security_settings[key] };
    try {
      await profileAPI.updateSecuritySettings(newSettings);
      loadData();
    } catch (e) {
      alert("Failed to update security settings");
    }
  };

  const toggleNotification = async (key: string) => {
    if (!profile) return;
    const newSettings = { ...profile.notification_settings, [key]: !profile.notification_settings[key] };
    try {
      await profileAPI.updateNotificationSettings(newSettings);
      loadData();
    } catch (e) {
      alert("Failed to update notification settings");
    }
  };

  const downloadReport = () => {
    if (!stats || !history) return;
    
    // Generate simple CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "REPORT TYPE,Admin Regional Performance & Activity Report\n";
    csvContent += `ADMIN NAME,${profile?.name}\n`;
    csvContent += `ROLE,${profile?.role}\n`;
    csvContent += `REGION,${profile?.division || profile?.district || 'Statewide'}\n\n`;
    
    csvContent += "--- METRICS ---\n";
    csvContent += `Active Regional Alerts,${stats.active_alerts}\n`;
    csvContent += `Total Users in Region,${stats.total_users}\n`;
    csvContent += `Regional Alerts Today,${stats.total_alerts_today}\n\n`;
    
    csvContent += "--- RECENT ACTIVITY ---\n";
    csvContent += "Timestamp,Action,Details\n";
    history.recent_activities?.forEach((act: any) => {
      const details = JSON.stringify(act.details || {}).replace(/,/g, ';');
      csvContent += `${new Date(act.timestamp).toISOString()},${act.action},${details}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `admin_report_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="pulse" style={{ color: '#8b5cf6', fontSize: '18px', fontWeight: 600 }}>LOADING PROFILE...</div>
      </div>
    );
  }

  if (!profile) return <div style={{ padding: 24, color: '#ef4444' }}>Failed to load profile.</div>;

  const roleDisplay = profile.role === 'super_admin' ? 'Statewide Operations (Super Admin)' :
                      profile.role === 'regional_admin' ? `${profile.division} Operator (Regional Admin)` :
                      profile.role === 'district_admin' ? `${profile.district} Operator (District Admin)` :
                      'Level 1 Operator';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#0f0a1c' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: '#fff', boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
            {profile.name?.[0] || 'A'}
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f8f4ff', margin: 0 }}>{profile.name}</h1>
            <p style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <Shield size={14} /> {roleDisplay}
            </p>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px', display: 'flex', gap: '16px' }}>
              <span>ID: {profile.id.substring(0, 8)}...</span>
              <span>Joined: {new Date(profile.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <button 
          onClick={downloadReport}
          className="glass-card" 
          style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}
        >
          <Download size={16} /> EXPORT REGIONAL REPORT
        </button>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
            <button onClick={() => setActiveTab('overview')} style={{ ...s.tab, ...(activeTab === 'overview' ? s.tabActive : {}) }}>Overview & Metrics</button>
            <button onClick={() => setActiveTab('security')} style={{ ...s.tab, ...(activeTab === 'security' ? s.tabActive : {}) }}>Security & Notifications</button>
            <button onClick={() => setActiveTab('activity')} style={{ ...s.tab, ...(activeTab === 'activity' ? s.tabActive : {}) }}>Activity Logs</button>
          </div>

          {activeTab === 'overview' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Profile Details Card */}
              <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8f4ff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} color="#8b5cf6" /> Profile Details
                  </h3>
                  <button onClick={() => setEditMode(!editMode)} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    {editMode ? 'CANCEL' : 'EDIT PROFILE'}
                  </button>
                </div>
                
                {editMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input style={s.input} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Full Name" />
                    <input style={s.input} value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="Phone Number" />
                    <button onClick={handleUpdateProfile} style={{ padding: '10px', background: '#8b5cf6', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <p style={s.label}>Full Name</p>
                      <p style={s.value}>{profile.name}</p>
                    </div>
                    <div>
                      <p style={s.label}>Phone Number</p>
                      <p style={s.value}>{profile.phone}</p>
                    </div>
                    <div>
                      <p style={s.label}>Assigned Region</p>
                      <p style={s.value}>{profile.division || profile.district || 'Statewide (All Regions)'}</p>
                    </div>
                    <div>
                      <p style={s.label}>Account Status</p>
                      <p style={{ ...s.value, color: profile.is_active ? '#10b981' : '#ef4444' }}>
                        {profile.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Regional Performance Metrics */}
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8f4ff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Activity size={18} color="#10b981" /> Regional Performance Metrics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={s.metricBox}>
                    <p style={s.metricLabel}>Total Users Monitored</p>
                    <p style={s.metricValue}>{stats?.total_users || 0}</p>
                  </div>
                  <div style={s.metricBox}>
                    <p style={s.metricLabel}>Active SOS Alerts</p>
                    <p style={{ ...s.metricValue, color: '#ef4444' }}>{stats?.active_alerts || 0}</p>
                  </div>
                  <div style={s.metricBox}>
                    <p style={s.metricLabel}>Alerts Processed Today</p>
                    <p style={{ ...s.metricValue, color: '#8b5cf6' }}>{stats?.total_alerts_today || 0}</p>
                  </div>
                </div>
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <strong style={{ color: '#10b981' }}>System Analytics:</strong> Your region currently accounts for approximately {(stats?.total_users ? (stats?.active_alerts / stats?.total_users * 100).toFixed(2) : 0)}% active alert density. Response coordination is operating nominally.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8f4ff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Lock size={18} color="#f59e0b" /> Security Settings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={s.settingRow}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Two-Factor Authentication (2FA)</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>Require a verification code when logging in.</p>
                    </div>
                    <button onClick={() => toggleSecurity('two_factor_auth')} style={profile.security_settings?.two_factor_auth ? s.toggleOn : s.toggleOff}>
                      {profile.security_settings?.two_factor_auth ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                  <div style={s.settingRow}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Biometric / Hardware Key Login</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>Allow WebAuthn for faster console access.</p>
                    </div>
                    <button onClick={() => toggleSecurity('biometric_login')} style={profile.security_settings?.biometric_login ? s.toggleOn : s.toggleOff}>
                      {profile.security_settings?.biometric_login ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8f4ff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Bell size={18} color="#06b6d4" /> Broadcast & Notification Settings
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={s.settingRow}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Critical SMS Alerts</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>Receive SMS when a critical SOS is triggered in your region.</p>
                    </div>
                    <button onClick={() => toggleNotification('sms_alerts')} style={profile.notification_settings?.sms_alerts ? s.toggleOn : s.toggleOff}>
                      {profile.notification_settings?.sms_alerts ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                  <div style={s.settingRow}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>Push Notifications</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8' }}>Browser push notifications for general updates.</p>
                    </div>
                    <button onClick={() => toggleNotification('push_notifications')} style={profile.notification_settings?.push_notifications ? s.toggleOn : s.toggleOff}>
                      {profile.notification_settings?.push_notifications ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8f4ff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FileText size={18} color="#a78bfa" /> Recent Activity Logs
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {history?.recent_activities?.length > 0 ? (
                  history.recent_activities.map((act: any, i: number) => (
                    <div key={i} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{act.action.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(act.timestamp).toLocaleString()}</span>
                      </div>
                      <pre style={{ margin: 0, fontSize: '11px', color: '#a78bfa', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', overflowX: 'auto' }}>
                        {JSON.stringify(act.details, null, 2)}
                      </pre>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#64748b', fontSize: '13px' }}>No recent activity found.</p>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Sidebar Info Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.1) 0%, rgba(15, 10, 28, 1) 100%)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '16px' }}>Operational Scope</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <MapPin size={16} color="#94a3b8" />
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{profile.division || 'All Divisions'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <MapPin size={16} color="#94a3b8" />
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{profile.district || 'All Districts'}</span>
              </div>
            </div>
          </div>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> AI Monitoring Settings
            </h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '16px' }}>
              Your region is currently utilizing standard AI predictive modeling. To adjust risk thresholds for automated patrols, please contact Statewide Operations.
            </p>
            <div style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '6px' }}>
              <CheckCircle size={14} /> AI Predictive Engine is Online
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const s: Record<string, React.CSSProperties> = {
  tab: { padding: '10px 20px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { color: '#fff', borderBottom: '2px solid #8b5cf6' },
  label: { fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginBottom: '4px' },
  value: { fontSize: '15px', color: '#f8f4ff', fontWeight: 600 },
  input: { padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid #8b5cf6', borderRadius: '8px', color: '#fff', fontSize: '14px', outline: 'none' },
  metricBox: { padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' },
  metricLabel: { fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' },
  metricValue: { fontSize: '32px', fontWeight: 800, color: '#f8f4ff' },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' },
  toggleOn: { padding: '6px 12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
  toggleOff: { padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
};
