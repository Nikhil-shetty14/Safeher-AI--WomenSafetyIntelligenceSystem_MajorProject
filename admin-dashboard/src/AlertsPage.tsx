import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from './api';
import { 
  AlertTriangle, Clock, MapPin, CheckCircle, 
  ExternalLink, User, Phone, ShieldAlert, X, Trash2
} from 'lucide-react';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getRecentAlerts(50);
      setAlerts(res.data || []);
    } catch (e) {
      console.error("Failed to load alerts", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const handleResolve = async (id: string) => {
    if (!window.confirm("Mark this emergency as RESOLVED?")) return;
    try {
      await adminAPI.resolveAlert(id);
      load();
    } catch (e) {
      alert("Failed to resolve alert");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("⚠️ DANGER: PERMANENT DELETION ⚠️\n\nAre you absolutely sure you want to PERMANENTLY DELETE this emergency alert?\n\nThis will erase all incident logs, threat analytics, and maps records for this alert! This action CANNOT BE UNDONE!")) return;
    try {
      await adminAPI.deleteAlert(id);
      setSelectedAlert(null); // Close modal if open
      load();
    } catch (e) {
      alert("Failed to permanently delete alert");
    }
  };

  const filtered = alerts.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  if (loading) return <div style={{ color: '#8b5cf6', padding: 40, background: 'var(--bg-main)', minHeight: '100vh' }}>SCANNING EMERGENCY FREQUENCIES...</div>;

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto', position: 'relative', background: 'var(--bg-main)' }}>
      {/* Detail Modal */}
      {selectedAlert && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '650px', padding: '32px', border: '1px solid rgba(139,92,246,0.3)', position: 'relative' }}>
            <button 
              onClick={() => setSelectedAlert(null)} 
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: selectedAlert.status === 'active' ? '#ef4444' : '#10b981', boxShadow: selectedAlert.status === 'active' ? '0 0 10px #ef4444' : 'none' }} />
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>Intelligence Report</h2>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>Reference ID: {selectedAlert.id}</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={s.modalLabel}>Subject Personnel</p>
                <p style={s.modalValue}>{selectedAlert.user_name || 'N/A'}</p>
                <p style={s.modalSub}>{selectedAlert.user_phone || 'No phone data'}</p>
              </div>
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={s.modalLabel}>Incident Timestamp</p>
                <p style={s.modalValue}>
                  {new Date(selectedAlert.created_at + (selectedAlert.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  })}
                </p>
                <p style={s.modalSub}>
                  {new Date(selectedAlert.created_at + (selectedAlert.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { 
                    timeZone: 'Asia/Kolkata', 
                    dateStyle: 'medium' 
                  })}
                </p>
              </div>
            </div>

            <div style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)', borderRadius: '16px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>AI Safety Engine Analysis</p>
                <span style={{ fontSize: '12px', fontWeight: 800, color: selectedAlert.ai_analysis?.danger_level === 'high' ? '#ef4444' : '#f59e0b', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '20px' }}>
                  RISK: {selectedAlert.ai_analysis?.danger_level?.toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              <p style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: 1.6, fontWeight: 500 }}>
                {selectedAlert.ai_analysis?.reasoning || "Analyzing incident patterns... No reasoning provided by AI engine."}
              </p>
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(139,92,246,0.1)' }}>
                 <p style={{ fontSize: '11px', fontWeight: 800, color: '#a78bfa', textTransform: 'uppercase' }}>Recommended Response</p>
                 <p style={{ fontSize: '14px', marginTop: '6px', color: '#fff', fontWeight: 600 }}>{selectedAlert.ai_analysis?.suggested_action || "Deploy emergency units to coordinates immediately."}</p>
              </div>
            </div>

            <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
              <button 
                onClick={() => handleDelete(selectedAlert.id)} 
                style={{ 
                  flex: 1, padding: '14px', borderRadius: '10px', 
                  border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)', 
                  color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Trash2 size={16} /> DELETE
              </button>
              <button onClick={() => setSelectedAlert(null)} style={{ flex: 1, padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px' }}>CLOSE</button>
              <button 
                onClick={() => { window.open(`https://www.google.com/maps?q=${selectedAlert.location?.latitude},${selectedAlert.location?.longitude}`); }} 
                style={{ flex: 1, padding: '14px', borderRadius: '10px', background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 15px rgba(139,92,246,0.3)' }}
              >
                LOCATE SOURCE
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>Emergency Management</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Real-time SOS interception and response console.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{ 
              background: '#1e1b4b', color: '#fff', border: '1px solid #312e81', 
              borderRadius: '8px', padding: '10px 16px', fontSize: '14px', outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Alerts</option>
            <option value="active">Active Only</option>
            <option value="resolved">Resolved</option>
          </select>
          <button onClick={load} className="glass-card" style={{ padding: '10px 20px', color: '#8b5cf6', cursor: 'pointer', fontWeight: 700 }}>REFRESH</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
            <ShieldAlert size={64} style={{ margin: '0 auto 20px', opacity: 0.2 }} />
            <p style={{ fontSize: '18px', fontWeight: 600 }}>No active alerts in this sector.</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <div key={alert.id} className={`glass-card ${alert.status === 'active' ? 'emergency-glow' : ''}`} style={{ padding: '24px', border: alert.status === 'active' ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ 
                    width: '64px', height: '64px', borderRadius: '18px', 
                    background: alert.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: alert.status === 'active' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: alert.status === 'active' ? '0 0 20px rgba(239,68,68,0.2)' : 'none'
                  }}>
                    <AlertTriangle size={32} color={alert.status === 'active' ? '#ef4444' : '#64748b'} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{alert.user_name || 'Anonymous User'}</h3>
                      <span className={`badge badge-${alert.severity}`}>{alert.severity}</span>
                      {alert.status === 'resolved' && <span className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>RESOLVED</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                      <div style={s.infoItem}><User size={14} /> <span>{alert.user_email || 'N/A'}</span></div>
                      <div style={s.infoItem}><Phone size={14} /> <span>{alert.user_phone || 'N/A'}</span></div>
                       <div style={s.infoItem}>
                         <Clock size={14} /> 
                         <span>
                           {new Date(alert.created_at + (alert.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { 
                             timeZone: 'Asia/Kolkata',
                             dateStyle: 'short',
                             timeStyle: 'short'
                           })}
                         </span>
                       </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button 
                    onClick={() => handleDelete(alert.id)}
                    style={{ 
                      padding: '12px', color: '#ef4444', cursor: 'pointer', 
                      background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="Permanently Delete Alert"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={() => setSelectedAlert(alert)}
                    className="glass-card" 
                    style={{ padding: '12px 24px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: 'rgba(255,255,255,0.05)' }}
                  >
                    VIEW INTEL
                  </button>
                  {alert.status === 'active' && (
                    <button 
                      onClick={() => handleResolve(alert.id)}
                      style={{ 
                        background: '#10b981', color: '#fff', border: 'none', 
                        borderRadius: '10px', padding: '12px 24px', fontWeight: 700, 
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
                      }}
                    >
                      <CheckCircle size={18} /> RESOLVE
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  infoItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#94a3b8' },
  modalLabel: { fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' },
  modalValue: { fontSize: '16px', fontWeight: 700, color: '#fff' },
  modalSub: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' }
};
