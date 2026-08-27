/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAPI, broadcastAPI } from './api';
import { useSocket } from './SocketContext';
import { useAdminAuth } from './AuthContext';
import {
  AlertTriangle, Shield, Activity,
  Brain, Clock, Radio, FileText,
  Download, Printer, Zap
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
  <div className="glass-card stat-card print-card" style={{ padding: '20px', display: 'flex', gap: '16px', flex: 1, minWidth: '220px' }}>
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
  const getInitial = (key: string, def: any) => {
    try {
      const cached = localStorage.getItem(`dash_cache_${key}`);
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return def;
  };

  const [stats, setStats] = useState<Stats | null>(getInitial('stats', null));
  const [alerts, setAlerts] = useState<any[]>(getInitial('alerts', []));
  const [trends, setTrends] = useState<any[]>(getInitial('trends', mockTrends));
  const [performance, setPerformance] = useState<any>(getInitial('performance', null));
  const [rankings, setRankings] = useState<any[]>(getInitial('rankings', []));
  const [broadcasts, setBroadcasts] = useState<any[]>(getInitial('broadcasts', []));
  const [complaints, setComplaints] = useState<any[]>(getInitial('complaints', []));
  const [escalations, setEscalations] = useState<any>(getInitial('escalations', null));
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const { socket } = useSocket();
  const { user } = useAdminAuth();

  const [tacticalIntel, setTacticalIntel] = useState<any>(null);
  const [predictiveIntel, setPredictiveIntel] = useState<any>(null);
  const [showRiskReport, setShowRiskReport] = useState(false);

  useEffect(() => {
    if (!socket) return;
    
    socket.on('tactical_intel_update', (intel) => setTacticalIntel(intel));
    
    socket.on('new_sos_alert', (d) => {
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

    return () => {
      socket.off('tactical_intel_update');
      socket.off('new_sos_alert');
    };
  }, [socket]);

  const load = useCallback(async () => {
    try {
      const [statsRes, alertsRes, trendsRes, perfRes, rankRes, bcRes, compRes, escRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getRecentAlerts(10),
        adminAPI.getDangerTrends(),
        adminAPI.getStatePerformance().catch(() => ({ data: null })),
        adminAPI.getStateRankings().catch(() => ({ data: [] })),
        broadcastAPI.getHistory(0, 10).catch(() => ({ data: [] })),
        adminAPI.getComplaints().catch(() => ({ data: [] })),
        adminAPI.getStateEscalations().catch(() => ({ data: null }))
      ]);

      setStats(statsRes.data);
      setAlerts(alertsRes.data || []);
      setPerformance(perfRes.data);
      setRankings(rankRes.data || []);
      setBroadcasts(bcRes.data || []);
      setComplaints(compRes.data || []);
      setEscalations(escRes.data);
      
      // Cache data
      const safeCache = (key: string, val: any) => { try { localStorage.setItem(`dash_cache_${key}`, JSON.stringify(val)) } catch(e) {} };
      safeCache('stats', statsRes.data);
      safeCache('alerts', alertsRes.data || []);
      safeCache('performance', perfRes.data);
      safeCache('rankings', rankRes.data || []);
      safeCache('broadcasts', bcRes.data || []);
      safeCache('complaints', compRes.data || []);
      safeCache('escalations', escRes.data);

      adminAPI.getPredictiveIntel()
        .then(res => setPredictiveIntel(res.data))
        .catch(e => console.error("Predictive Intel Error:", e));
      
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
      const tData = chartData.length > 0 ? chartData : mockTrends;
      setTrends(tData);
      safeCache('trends', tData);
      
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      console.error("Failed to load dashboard data", e);
      setError(e.response?.data?.detail || "Connection to Command Server failed.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // 30s refresh for executive view
    return () => clearInterval(t);
  }, [load]);

  const exportToCSV = () => {
    const rows = [
      ["SafeHer AI: A Statewide Intelligent Women's Safety and Emergency Response Ecosystem"],
      [`Generated At: ${new Date().toLocaleString()}`],
      [],
      ["--- DISTRICT RISK SCORES & ADMIN PERFORMANCE ---"],
      ["Admin ID", "Name", "Region", "Resolved SOS", "Resolved Complaints", "Pending Load", "Score"]
    ];
    
    rankings.forEach(r => {
      rows.push([r.admin_id, r.name, r.region, r.resolved_sos, r.resolved_complaints, r.pending_load, r.score]);
    });
    
    rows.push([]);
    rows.push(["--- COMPLAINT ANALYTICS ---"]);
    rows.push(["ID", "Title", "Status", "Created At"]);
    complaints.forEach(c => {
      rows.push([c.id, c.title, c.status, new Date(c.created_at).toLocaleString()]);
    });

    rows.push([]);
    rows.push(["--- RECENT CRITICAL ALERTS ---"]);
    rows.push(["User", "Severity", "Location", "Time"]);
    alerts.forEach(a => {
      const locStr = (a.location?.latitude != null && a.location?.longitude != null) ? `${a.location.latitude}, ${a.location.longitude}` : 'Unknown';
      rows.push([a.user_name || 'Anonymous', a.severity, locStr, new Date(a.created_at).toLocaleString()]);
    });

    const csvContent = rows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SafeHer_Executive_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };



  return (
    <div className="dashboard-container" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', background: '#0a0514' }}>
      {/* HEADER TIER */}
      <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8f4ff', letterSpacing: '-0.5px' }}>SafeHer AI Executive Dashboard</h1>
          <p style={{ color: '#b8a9d9', fontSize: '14px', marginTop: '4px' }}>AI-Powered Women's Safety, Emergency Response & Public Protection Platform</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: error ? '#ef4444' : '#10b981', boxShadow: `0 0 10px ${error ? '#ef4444' : '#10b981'}` }} />
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>
              {error ? `SYSTEM ERROR: ${error}` : `SYSTEM SECURE • SYNCED: ${lastRefresh.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={exportToCSV} className="action-btn hover-glow" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', color: '#a78bfa', fontWeight: 600, cursor: 'pointer' }}>
            <Download size={16} /> EXPORT CSV
          </button>
          <button onClick={handlePrint} className="action-btn hover-glow" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', color: '#10b981', fontWeight: 600, cursor: 'pointer' }}>
            <Printer size={16} /> PRINT PDF
          </button>
        </div>
      </div>

      <div className="print-only" style={{ display: 'none', marginBottom: '20px' }}>
        <h1 style={{ color: '#000', fontSize: '24px', fontWeight: 800 }}>SafeHer AI Executive Report</h1>
        <p style={{ color: '#333', fontSize: '14px' }}>A Statewide Intelligent Women's Safety and Emergency Response Ecosystem</p>
        <p style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>Generated: {new Date().toLocaleString()}</p>
        <hr style={{ borderColor: '#ccc', margin: '10px 0' }} />
      </div>

      {/* TIER 1: EXECUTIVE KPIs */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard icon={AlertTriangle} label="Active SOS" value={stats?.active_alerts} color="#ef4444" sub={`${stats?.critical_alerts || 0} Critical Priority`} />
        <StatCard icon={Clock} label="Avg Response Time" value={`${performance?.sos?.avg_response_time_mins || '< 1'}m`} color="#f59e0b" sub="SLA Compliance: 98.5%" />
        <StatCard icon={Radio} label="Active Broadcasts" value={broadcasts.length} color="#06b6d4" sub={`${stats?.connected_users || 0} Users Reached`} />
        <StatCard icon={FileText} label="Pending Complaints" value={complaints.filter(c => c.status === 'pending').length} color="#8b5cf6" sub={`${complaints.length} Total Registered`} />
      </div>

      {/* TIER 2: LIVE EMERGENCY QUEUE & ESCALATIONS */}
      <div className="grid-row-2 print-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Live Emergency Queue */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#ef4444" /> Live Emergency Queue
            </h3>
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 700, background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
              {alerts.length} ACTIVE
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>No active alerts in queue.</p>
            ) : (
              alerts.map(a => (
                <div key={a.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '3px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#f8f4ff' }}>{a.user_name || 'Anonymous'}</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{new Date(a.created_at).toLocaleTimeString()} • {a.location?.district || 'Unknown Zone'}</p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>{a.severity}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Escalations & SLA */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <AlertTriangle size={18} color="#f59e0b" /> SLA Escalations
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div>
                <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>Breached SOS Alerts</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8f4ff' }}>{escalations?.breached_sos_count || 0}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 700 }}>Breached Complaints</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: '#f8f4ff' }}>{escalations?.breached_complaints_count || 0}</p>
              </div>
            </div>
            
            {escalations?.breached_alerts && escalations.breached_alerts.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600 }}>Action Required</p>
                {escalations.breached_alerts.slice(0,3).map((alert: any) => (
                  <div key={alert.id} style={{ fontSize: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                     <span style={{ color: '#e2e8f0' }}>Alert from {alert.user_name || 'User'}</span>
                     <span style={{ color: '#ef4444', fontWeight: 700 }}>OVERDUE</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TIER 3: INTELLIGENCE & ANALYTICS */}
      <div className="grid-row-3 print-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* AI Predictive Intel */}
        <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(15,10,30,0.7) 100%)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Brain size={18} color="#a78bfa" /> AI Threat Predictions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(139,92,246,0.2)' }}>
              <p style={{ color: '#a78bfa', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{predictiveIntel?.target_zone || 'Analyzing...'}</p>
              <p style={{ fontSize: '14px', marginTop: '4px', color: '#e2e8f0', lineHeight: 1.5 }}>
                {predictiveIntel ? predictiveIntel.prediction_text : "Generating tactical risk assessment based on recent anomaly data..."}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Confidence Score</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981' }}>{predictiveIntel ? predictiveIntel.confidence_score : 0}%</span>
            </div>
            <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
              <div style={{ height: '100%', width: `${predictiveIntel ? predictiveIntel.confidence_score : 0}%`, background: '#10b981', borderRadius: '2px', transition: 'width 1s ease-out' }} />
            </div>
            <button 
              onClick={() => setShowRiskReport(true)}
              className="action-btn hover-glow print-hide"
              style={{ width: '100%', padding: '12px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', color: '#c4b5fd', fontWeight: 600, marginTop: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              VIEW TACTICAL RISK REPORT
            </button>
          </div>
        </div>

        {/* System Activity Trends */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Activity size={18} color="#10b981" /> System Activity Trends
          </h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1540" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px', color: '#f8f4ff' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="risk" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" name="Risk Index" />
                <Area type="monotone" dataKey="alerts" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorAlerts)" name="Alert Volume" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* TIER 4: DISTRICT RISK SCORES & ADMIN PERFORMANCE */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Shield size={18} color="#06b6d4" /> District Risk Scores & Admin Performance Metrics
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Region / District</th>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Admin Name</th>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Resolved SOS</th>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Resolved Complaints</th>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Pending Load</th>
                <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Performance Score</th>
              </tr>
            </thead>
            <tbody>
              {rankings.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No admin performance data available.</td></tr>
              ) : (
                rankings.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '12px', color: '#f8f4ff', fontWeight: 600 }}>{r.region || 'Statewide'}</td>
                    <td style={{ padding: '12px', color: '#e2e8f0' }}>{r.name}</td>
                    <td style={{ padding: '12px', color: '#10b981' }}>{r.resolved_sos}</td>
                    <td style={{ padding: '12px', color: '#06b6d4' }}>{r.resolved_complaints}</td>
                    <td style={{ padding: '12px', color: '#f59e0b' }}>{r.pending_load}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                           <div style={{ width: `${Math.min(r.score, 100)}%`, height: '100%', background: r.score > 80 ? '#10b981' : r.score > 50 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: r.score > 80 ? '#10b981' : r.score > 50 ? '#f59e0b' : '#ef4444' }}>{Math.round(r.score)}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Report Modal */}
      <AnimatePresence>
        {showRiskReport && (
          <motion.div 
            className="print-hide"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setShowRiskReport(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: '600px', background: '#120c2b',
                border: '1px solid #2a1f4a', borderRadius: '16px', padding: '32px',
                boxShadow: '0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                position: 'relative'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Brain color="#a78bfa" size={24} />
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8f4ff' }}>Tactical Risk Report</h3>
                </div>
                <span style={{
                  background: predictiveIntel?.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', border: `1px solid ${predictiveIntel?.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b'}`,
                  color: predictiveIntel?.risk_level === 'HIGH' ? '#ef4444' : '#f59e0b', padding: '4px 8px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase'
                }}>{predictiveIntel?.risk_level || 'UNKNOWN'} RISK</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Target Zone</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{predictiveIntel?.target_zone || 'Unknown Zone'}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Confidence Index</p>
                    <p style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{predictiveIntel?.confidence_score || 0}%</p>
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase' }}>Historical Incidents</p>
                    <p style={{ fontSize: '18px', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>{predictiveIntel?.historical_incidents_count || 0} Recent Alerts</p>
                  </div>
                </div>

                <div>
                  <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Threat Breakdown</p>
                  <ul style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(predictiveIntel?.threat_breakdown || []).map((threat: string, i: number) => (
                      <li key={i}>{threat}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>Mitigation Guidelines</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(predictiveIntel?.mitigation_guidelines || []).map((guide: string, i: number) => {
                      const colors = ['#8b5cf6', '#06b6d4', '#10b981'];
                      const color = colors[i % colors.length];
                      return (
                        <div key={i} style={{ padding: '8px 12px', background: `${color}15`, borderRadius: '6px', borderLeft: `3px solid ${color}` }}>
                          {guide}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowRiskReport(false)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px' }}>
                ×
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
