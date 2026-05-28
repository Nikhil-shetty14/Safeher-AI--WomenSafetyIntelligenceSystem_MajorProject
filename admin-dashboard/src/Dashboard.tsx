/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI } from './api';
import { useSocket } from './SocketContext';
import {
  AlertTriangle, Shield, Activity,
  Wifi, Zap, Brain,
  Clock, MapPin, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer
} from 'recharts';

const mockTrends = [
  { name: '00:00', alerts: 2, risk: 10 },
  { name: '04:00', alerts: 1, risk: 5 },
  { name: '08:00', alerts: 5, risk: 35 },
  { name: '12:00', alerts: 8, risk: 65 },
  { name: '16:00', alerts: 12, risk: 85 },
  { name: '20:00', alerts: 9, risk: 70 },
];

interface Stats {
  total_users: number; active_alerts: number; total_alerts_today: number;
  critical_alerts: number; total_ai_predictions: number;
  connected_users: number; live_tracking_users: number;
}

const StatCard = ({ icon: Icon, label, value, color, sub }: any) => (
  <div className="glass-card" style={{ padding: '20px', display: 'flex', gap: '16px' }}>
    <div style={{ 
      width: '48px', height: '48px', borderRadius: '12px', 
      background: color + '15', display: 'flex', alignItems: 'center', 
      justifyContent: 'center', border: `1px solid ${color}30` 
    }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8f4ff', margin: '2px 0' }}>{value ?? '0'}</h2>
      <p style={{ color: '#64748b', fontSize: '11px' }}>{sub}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { socket } = useSocket();
  const [logs, setLogs] = useState<any[]>([]);

  const [tacticalIntel, setTacticalIntel] = useState<any>(null);
  const [showRiskReport, setShowRiskReport] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('tactical_intel_update', (intel) => {
      setTacticalIntel(intel);
      // Also add to logs
      const log = {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        type: 'TACTICAL_INTEL',
        message: `Intelligence update for ${intel.user_name}`,
        data: intel
      };
      setLogs(prev => [log, ...prev].slice(0, 20));
    });

    const handler = (data: any, type: string) => {
      const log = {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        type,
        message: data.message || `New ${type} received`,
        data
      };
      setLogs(prev => [log, ...prev].slice(0, 20));
    };

    socket.on('new_sos_alert', (d) => {
      handler(d, 'SOS_ALERT');
      setAlerts(prev => {
        if (prev.find(a => a.id === d.alert_id)) return prev;
        const newAlert = {
          id: d.alert_id,
          user_id: d.user_id,
          user_name: d.user_name,
          severity: d.severity,
          location: d.location,
          created_at: d.location?.timestamp || new Date().toISOString()
        };
        return [newAlert, ...prev];
      });
    });
    socket.on('user_location_update', (d) => handler(d, 'TRACKING'));
    socket.on('ai_prediction', (d) => handler(d, 'AI_INTEL'));

    return () => {
      socket.off('tactical_intel_update');
      socket.off('new_sos_alert');
      socket.off('user_location_update');
      socket.off('ai_prediction');
    };
  }, [socket]);

  const load = useCallback(async () => {
    try {
      const [statsRes, alertsRes, trendsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getRecentAlerts(5),
        adminAPI.getDangerTrends()
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data || []);
      
      const chartData = (trendsRes.data || []).map((t: any) => {
        const high = t.levels.high || 0;
        const medium = t.levels.medium || 0;
        const low = t.levels.low || 0;
        return {
          name: t.date.split('-').slice(1).join('/'),
          risk: high * 10 + medium * 5,
          alerts: high + medium + low
        };
      });
      setTrends(chartData.length > 0 ? chartData : mockTrends);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      console.error("Failed to load dashboard data", e);
      setError(e.response?.data?.detail || "Connection to Command Server failed.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);



  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="pulse" style={{ color: '#8b5cf6', fontSize: '18px', fontWeight: 600 }}>INITIALIZING COMMAND CENTER...</div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ flex: 1, padding: '24px', overflowY: 'auto' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(to right, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Emergency Command Center
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
            Real-time monitoring active • System Status: <span style={{ color: '#10b981', fontWeight: 600 }}>SECURE</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Last Data Sync</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8f4ff' }}>
               {lastRefresh.toLocaleString('en-IN', { 
                 timeZone: 'Asia/Kolkata', 
                 hour: '2-digit', 
                 minute: '2-digit', 
                 second: '2-digit', 
                 hour12: true 
               })}
             </span>
             <button onClick={load} className="glass-card" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: '#a78bfa' }}>SYNC NOW</button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', 
          color: '#ef4444', padding: '12px 16px', borderRadius: '12px', 
          marginBottom: '24px', fontSize: '14px', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="dashboard-grid-stats">
        <StatCard icon={AlertTriangle} label="Active SOS" value={stats?.active_alerts} color="#ef4444" sub="Immediate response required" />
        <StatCard icon={Zap} label="Response Time" value="2.4m" color="#f59e0b" sub="Average dispatch latency" />
        <StatCard icon={Wifi} label="Live Tracking" value={stats?.live_tracking_users} color="#06b6d4" sub="Users currently monitored" />
        <StatCard icon={Brain} label="AI Danger Index" value="14%" color="#10b981" sub="Overall city threat level" />
      </div>

      <div className="dashboard-grid-main">
        {/* Main Chart Area */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#8b5cf6" /> System Activity & Threat Trends
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#8b5cf6' }} /> <span style={{ fontSize: 11, color: '#94a3b8' }}>SOS Alerts</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444' }} /> <span style={{ fontSize: 11, color: '#94a3b8' }}>Risk Score</span></div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1b4b" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="risk" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" strokeWidth={3} />
              <Area type="monotone" dataKey="alerts" stroke="#8b5cf6" fillOpacity={0} strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* AI Insight Panel */}
        <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(15,10,30,0.7) 100%)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Brain size={18} color="#a78bfa" /> AI Predictive Intel
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Threat Prediction</p>
              <p style={{ fontSize: '14px', marginTop: '4px', color: '#e2e8f0' }}>High likelihood of incidents in <span style={{ color: '#f59e0b' }}>Sector 7</span> due to low lighting & reported suspicious activity.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Confidence Score</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>94.2%</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: '94%', background: '#10b981', borderRadius: '2px' }} />
            </div>
            <button 
              onClick={() => setShowRiskReport(true)}
              className="glass-card" 
              style={{ width: '100%', padding: '10px', marginTop: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#fff', background: '#8b5cf6' }}
            >
              GENERATE RISK REPORT
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Alerts & Audio */}
      <div className="dashboard-grid-bottom">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card" 
          style={{ padding: '24px' }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <AlertTriangle size={18} color="#ef4444" /> Live Emergency Queue
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No active emergencies detected.</div>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className={`glass-card ${a.severity === 'critical' ? 'emergency-glow' : ''}`} style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: a.severity === 'critical' ? '#ef444420' : '#8b5cf620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={20} color={a.severity === 'critical' ? '#ef4444' : '#8b5cf6'} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px' }}>{a.user_name || 'Anonymous User'}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                        <span className={`badge badge-${a.severity}`}>{a.severity}</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          <Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> 
                          {new Date(a.created_at + (a.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: '#94a3b8' }}><MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} /> {a.location?.latitude?.toFixed(4)}, {a.location?.longitude?.toFixed(4)}</p>
                    <button style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}>
                      RESPOND <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Media & Tactical Intelligence Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-card" style={{ padding: '24px', border: tacticalIntel ? '1px solid #a78bfa' : '1px solid #1e293b' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Shield size={18} color="#a78bfa" /> Tactical Intel: {tacticalIntel?.user_name || 'N/A'}
            </h3>
            
            {tacticalIntel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(167, 139, 250, 0.05)', borderRadius: '12px', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                  <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>AI Transcript</p>
                  <p style={{ fontSize: '14px', color: '#f8f4ff', fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{tacticalIntel.transcript || "No speech detected..."}"
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                   <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Risk Score</p>
                      <p style={{ fontSize: '20px', fontWeight: 800, color: tacticalIntel.intelligence.risk_score > 70 ? '#ef4444' : '#f59e0b' }}>
                        {tacticalIntel.intelligence.risk_score}%
                      </p>
                   </div>
                   <div className="glass-card" style={{ padding: '12px', textAlign: 'center' }}>
                      <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Danger Level</p>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444' }}>{tacticalIntel.intelligence.danger_level}</p>
                   </div>
                </div>

                <div>
                   <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Tactical Summary</p>
                   <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.4 }}>{tacticalIntel.intelligence.ai_tactical_summary}</p>
                </div>

                <div>
                   <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Recommended Actions</p>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {tacticalIntel.intelligence.recommendations.map((r: string, i: number) => (
                        <span key={i} style={{ fontSize: '11px', padding: '4px 8px', background: '#8b5cf620', color: '#a78bfa', borderRadius: '4px', border: '1px solid #8b5cf630' }}>{r}</span>
                      ))}
                   </div>
                </div>

                <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Live Audio Evidence</p>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '16px' }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: ['4px', `${Math.random() * 12 + 4}px`, '4px'] }}
                          transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5 }}
                          style={{ width: '3px', background: '#ef4444', borderRadius: '2px' }}
                        />
                      ))}
                    </div>
                  </div>
                  <audio controls style={{ width: '100%', height: '32px' }}>
                    <source src={`${adminAPI.defaults.baseURL}/api/sos/audio/${tacticalIntel.alert_id}`} type="audio/wav" />
                  </audio>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                 <Activity size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                 <p style={{ fontSize: '13px' }}>Waiting for tactical intelligence feed...</p>
              </div>
            )}
          </div>

          {/* Tactical Intel Feed */}
          <div className="glass-card" style={{ flex: 1, padding: '24px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(139,92,246,0.1)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
               <Shield size={16} /> SYSTEM LIVE LOGS
            </h3>
            <div style={{ height: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {logs.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>Awaiting live intelligence feed...</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', borderLeft: `3px solid ${log.type === 'SOS_ALERT' ? '#ef4444' : '#8b5cf6'}`, fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.6, marginBottom: '2px' }}>
                      <span style={{ fontWeight: 800 }}>{log.type}</span>
                      <span>{log.time}</span>
                    </div>
                    <p style={{ color: '#cbd5e1' }}>{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Risk Report Modal */}
      {showRiskReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 10, 30, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="glass-card" style={{
            width: '550px', padding: '32px', border: '1px solid rgba(139, 92, 246, 0.3)',
            background: 'linear-gradient(135deg, #16102b 0%, #0c081d 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', borderRadius: '16px',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Brain color="#a78bfa" size={24} />
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8f4ff' }}>Tactical Risk Report</h3>
              </div>
              <span style={{
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444',
                color: '#ef4444', padding: '4px 8px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 700, textTransform: 'uppercase'
              }}>HIGH RISK</span>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Target Zone</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>Sector 7 — Central Urban District</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Confidence Index</p>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>94.2%</p>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Historical Incidents</p>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>12 Active Alerts</p>
                </div>
              </div>

              <div>
                <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Threat Breakdown</p>
                <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li><strong>Infrastructure Deficit:</strong> Over 40% of street lighting reporting inactive or dim status.</li>
                  <li><strong>Voice Distress Anomalies:</strong> Live stress markers show cluster alerts near local transit stops.</li>
                  <li><strong>Spatial Vulnerability:</strong> Narrow pedestrian passages with extremely low density of smart safety booths.</li>
                </ul>
              </div>

              <div>
                <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Mitigation Guidelines</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ padding: '8px 12px', background: 'rgba(139,92,246,0.05)', borderRadius: '6px', borderLeft: '3px solid #8b5cf6' }}>
                     <strong>A. Smart Patrol Dispatch:</strong> Redirect active responder vehicle #04 to perform visual safety sweeps.
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(6,182,212,0.05)', borderRadius: '6px', borderLeft: '3px solid #06b6d4' }}>
                     <strong>B. Ad-hoc Routing Warning:</strong> Push warning triggers to users utilizing "Safe Routing" near Sector 7.
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button 
                onClick={() => {
                  alert('Emergency patrols dispatched to Sector 7.');
                  setShowRiskReport(false);
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                  background: '#8b5cf6', color: '#fff', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
                }}
              >
                DISPATCH PATROLS
              </button>
              <button 
                onClick={() => {
                  alert('SafeRoute warning advisory broadcast to all active mobile clients.');
                  setShowRiskReport(false);
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #06b6d4',
                  background: 'rgba(6,182,212,0.1)', color: '#06b6d4', fontWeight: 700, cursor: 'pointer'
                }}
              >
                BROADCAST ADVISORY
              </button>
              <button 
                onClick={() => setShowRiskReport(false)}
                style={{
                  padding: '12px 20px', borderRadius: '8px', border: '1px solid #334155',
                  background: 'transparent', color: '#94a3b8', fontWeight: 600, cursor: 'pointer'
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
