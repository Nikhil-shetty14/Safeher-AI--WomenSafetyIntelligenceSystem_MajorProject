/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { adminAPI } from './api';
import { useSocket } from './SocketContext';
import {
  AlertTriangle, Shield, Activity, Users, MapPin,
  Brain, Clock, Eye, CheckCircle, Image as ImageIcon,
  TrendingUp, ActivitySquare, AlertOctagon, HeartHandshake, Download, FileDown
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar, LineChart, Line
} from 'recharts';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';
import { AnimatePresence } from 'framer-motion';
import AlertIntelligencePanel from './components/AlertIntelligencePanel';

const PIE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
const libraries: any = ['visualization'];

function DashboardContent() {
  // State
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [liveUsers, setLiveUsers] = useState<any>({});
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Intel Panel State
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  
  const { socket } = useSocket();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries
  });

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, alertsRes, trendsRes, liveRes, meRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getActiveAlerts(),
        adminAPI.getDangerTrends(),
        adminAPI.getLiveUsers(),
        adminAPI.getMe()
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data || []);
      setAdminProfile(meRes.data);
      
      const chartData = (trendsRes.data || []).map((t: any) => ({
        name: new Date(t.date).toLocaleDateString('en', { weekday: 'short' }),
        high: t.levels?.high || 0,
        medium: t.levels?.medium || 0,
        low: t.levels?.low || 0,
        incidents: (t.levels?.high || 0) + (t.levels?.medium || 0) + (t.levels?.low || 0)
      }));
      setTrends(chartData.length ? chartData : [
        {name: 'Mon', high: 2, medium: 5, low: 8, incidents: 15},
        {name: 'Tue', high: 1, medium: 3, low: 6, incidents: 10},
        {name: 'Wed', high: 4, medium: 7, low: 10, incidents: 21},
        {name: 'Thu', high: 3, medium: 4, low: 9, incidents: 16},
        {name: 'Fri', high: 5, medium: 8, low: 12, incidents: 25},
      ]);
      
      const usersMap: any = {};
      (liveRes.data.live_users || []).forEach((u: any) => { usersMap[u.user_id] = u; });
      setLiveUsers(usersMap);
      
    } catch (e) {
      console.error("Dashboard data fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_sos_alert', (d: any) => {
      const normalized = {
        id: d.alert_id || d.id,
        user_id: d.user_id,
        user_name: d.user_name || 'Unknown',
        severity: d.severity,
        location: d.location,
        status: 'active',
        created_at: d.created_at || d.location?.timestamp || new Date().toISOString(),
      };
      setAlerts(prev => [normalized, ...prev.filter(a => a.id !== normalized.id)]);
      fetchData(); // refresh stats
    });
    socket.on('user_location_update', (d: any) => {
      setLiveUsers((prev: any) => ({ ...prev, [d.user_id]: d }));
    });
    return () => {
      socket.off('new_sos_alert');
      socket.off('user_location_update');
    };
  }, [socket, fetchData]);

  const handleViewIntel = (id: string) => {
    setSelectedAlertId(id);
  };

  const handleResolveAlert = async (id: string) => {
    try {
      await adminAPI.resolveAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
      setSelectedAlertId(null);
      fetchData();
    } catch (e) {
      alert("Failed to resolve alert.");
    }
  };

  const exportDashboardExcel = () => {
    try {
      // @ts-ignore
      if (!window.XLSX) {
        alert("Excel library loading. Please wait.");
        return;
      }
      
      // @ts-ignore
      const wb = window.XLSX.utils.book_new();
      
      // 1. KPI Data
      const kpiData = [
        { Metric: 'Total Users', Value: stats?.total_users || 0 },
        { Metric: 'Active SOS', Value: stats?.active_alerts || 0 },
        { Metric: 'Critical Alerts', Value: stats?.critical_alerts || 0 },
        { Metric: 'Resolved SOS', Value: (stats?.total_alerts_today || 0) - (stats?.active_alerts || 0) },
        { Metric: 'Live Users', Value: stats?.connected_users || 0 },
      ];
      // @ts-ignore
      const wsKPI = window.XLSX.utils.json_to_sheet(kpiData);
      // @ts-ignore
      window.XLSX.utils.book_append_sheet(wb, wsKPI, "KPI Overview");

      // 2. Active Alerts Data
      const alertsData = alerts.map(a => ({
        'Incident ID': a.id || a.alert_id,
        'User Name': a.user_name || 'Anonymous',
        'User Phone': a.user_phone || 'N/A',
        'Risk Level': a.severity?.toUpperCase() || 'UNKNOWN',
        'District': a.location?.district || 'Unknown',
        'Coordinates': `${a.location?.latitude || ''}, ${a.location?.longitude || ''}`,
        'Timestamp': new Date(a.created_at).toLocaleString(),
        'Status': 'UNRESOLVED'
      }));
      // @ts-ignore
      const wsAlerts = window.XLSX.utils.json_to_sheet(alertsData.length ? alertsData : [{ Message: 'No active alerts' }]);
      // @ts-ignore
      window.XLSX.utils.book_append_sheet(wb, wsAlerts, "Active Alerts");
      
      // 3. Admin Profile
      if (adminProfile) {
        const adminData = [
          { Key: 'Name', Value: adminProfile.name },
          { Key: 'Email', Value: adminProfile.email },
          { Key: 'Role', Value: adminProfile.role },
          { Key: 'Jurisdiction', Value: adminProfile.district || adminProfile.state || adminProfile.division || 'ALL' }
        ];
        // @ts-ignore
        const wsAdmin = window.XLSX.utils.json_to_sheet(adminData);
        // @ts-ignore
        window.XLSX.utils.book_append_sheet(wb, wsAdmin, "Admin Info");
      }

      // @ts-ignore
      window.XLSX.writeFile(wb, `SafeHer_Dashboard_${new Date().getTime()}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Error generating Excel file.");
    }
  };

  const exportDashboardPDF = () => {
    // @ts-ignore
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library loading. Please wait.");
      return;
    }
    // @ts-ignore
    const doc = new window.jspdf.jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("SafeHer AI Command Center Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Performance Indicators", 14, 42);
    
    // @ts-ignore
    doc.autoTable({
      startY: 48,
      head: [['Metric', 'Value']],
      body: [
        ['Total Users', stats?.total_users?.toString() || '0'],
        ['Active SOS', stats?.active_alerts?.toString() || '0'],
        ['Critical Alerts', stats?.critical_alerts?.toString() || '0'],
        ['Resolved SOS', ((stats?.total_alerts_today || 0) - (stats?.active_alerts || 0)).toString()],
        ['Live Users', stats?.connected_users?.toString() || '0']
      ],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] }
    });
    
    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 48;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Active SOS Emergencies", 14, finalY + 12);
    
    const tableData = alerts.map(a => [
      a.user_name || 'Anonymous',
      a.severity?.toUpperCase() || 'UNKNOWN',
      a.location?.district || 'Unknown',
      new Date(a.created_at).toLocaleString(),
      'UNRESOLVED'
    ]);
    
    if (tableData.length === 0) tableData.push(['No active emergencies.', '', '', '', '']);
    
    // @ts-ignore
    doc.autoTable({
      startY: finalY + 18,
      head: [['User', 'Risk', 'Location', 'Time', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] }
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    
    doc.save(`SafeHer_Dashboard_${new Date().getTime()}.pdf`);
  };



  // Mock data for new charts based on stats
  const riskDistribution = [
    { name: 'Critical', value: stats?.critical_alerts || 5 },
    { name: 'High', value: 12 },
    { name: 'Medium', value: 25 },
    { name: 'Low', value: 45 }
  ];
  
  const responseGraph = [
    { name: 'Active', count: stats?.active_alerts || 10 },
    { name: 'Resolved', count: (stats?.total_alerts_today || 30) - (stats?.active_alerts || 10) }
  ];

  const userAnalytics = [
    { name: 'Registered', users: stats?.total_users || 500 },
    { name: 'Active (Daily)', users: stats?.connected_users || 120 }
  ];

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: `1px solid ${color}30`, flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ background: `${color}15`, padding: '12px', borderRadius: '10px' }}>
        <Icon size={28} color={color} />
      </div>
      <div>
        <p style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 600 }}>{title}</p>
        <h3 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '4px 0 0 0' }}>{value}</h3>
      </div>
    </div>
  );

  return (
    <div id="dashboard-content" className="dashboard-container" style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#0a0514', minHeight: '100vh', color: '#fff' }}>
      {/* Premium Header */}
      <div style={{ 
        marginBottom: '32px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        background: 'linear-gradient(145deg, rgba(20, 15, 45, 0.8) 0%, rgba(10, 5, 20, 0.6) 100%)',
        padding: '24px 32px',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: 900, 
              background: 'linear-gradient(to right, #ffffff, #a78bfa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.5px'
            }}>
              SafeHer AI Command Center
            </h1>
            {adminProfile && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                 <span style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: '12px', fontSize: '11px', fontWeight: 800, letterSpacing: '1px' }}>
                   {adminProfile.role.replace('_', ' ')}
                 </span>
                 <span style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', borderRadius: '12px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
                   📍 {
                     adminProfile.role === 'CENTRAL_ADMIN' || adminProfile.role === 'SUPER_ADMIN' ? 'ALL STATES (INDIA)' :
                     adminProfile.role === 'STATE_ADMIN' || adminProfile.role === 'ADMIN' ? (adminProfile.state || 'ALL DISTRICTS') :
                     adminProfile.role === 'DIVISION_ADMIN' || adminProfile.role === 'REGIONAL_ADMIN' ? (adminProfile.division || 'DIVISION') :
                     (adminProfile.district || 'DISTRICT')
                   }
                 </span>
              </div>
            )}
          </div>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '15px', fontWeight: 400 }}>
            AI-Powered Women Safety Intelligence System • <span style={{ color: '#c4b5fd', fontWeight: 500 }}>Detect. Understand. Predict. Protect.</span>
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
           <button 
             onClick={exportDashboardExcel} 
             style={{ 
               display: 'flex', alignItems: 'center', gap: '8px', 
               background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', 
               color: '#e2e8f0', padding: '10px 20px', borderRadius: '12px', 
               cursor: 'pointer', fontWeight: 600, fontSize: '14px',
               transition: 'all 0.2s ease',
             }}
             onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
             onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
           >
             <FileDown size={18} /> Export Excel
           </button>
           <button 
             onClick={exportDashboardPDF} 

             style={{ 
               display: 'flex', alignItems: 'center', gap: '8px', 
               background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
               color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '12px', 
               cursor: 'pointer', fontWeight: 600, fontSize: '14px',
               boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
               transition: 'transform 0.2s ease, box-shadow 0.2s ease'
             }}
             onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'; }}
             onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'; }}
           >
             <Download size={18} /> Export PDF
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatCard icon={Users} title="Total Users" value={stats?.total_users || 0} color="#3b82f6" />
        <StatCard icon={AlertTriangle} title="Active SOS" value={stats?.active_alerts || 0} color="#ef4444" />
        <StatCard icon={AlertOctagon} title="Critical Alerts" value={stats?.critical_alerts || 0} color="#f59e0b" />
        <StatCard icon={HeartHandshake} title="Resolved SOS" value={(stats?.total_alerts_today || 0) - (stats?.active_alerts || 0)} color="#10b981" />
        <StatCard icon={ActivitySquare} title="Live Users" value={stats?.connected_users || 0} color="#8b5cf6" />
      </div>

      {/* Graphs Section 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* SOS Trend */}
        <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: '1px solid #2a1f4a' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} color="#8b5cf6"/> SOS Incidents Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1f4a" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="incidents" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: '1px solid #2a1f4a' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Brain size={18} color="#f59e0b"/> Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {riskDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px' }} />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Emergency Response */}
        <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: '1px solid #2a1f4a' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} color="#10b981"/> Response Efficacy</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={responseGraph}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1f4a" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}}/>
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphs Section 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* User Analytics */}
        <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: '1px solid #2a1f4a' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Users size={18} color="#3b82f6"/> User Analytics</h3>
          <ResponsiveContainer width="100%" height={200}>
             <BarChart data={userAnalytics} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1f4a" horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={100} />
              <RechartsTooltip contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px' }} cursor={{fill: 'rgba(255,255,255,0.05)'}}/>
              <Bar dataKey="users" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Risk Analytics */}
        <div style={{ background: '#120c2b', padding: '20px', borderRadius: '12px', border: '1px solid #2a1f4a' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} color="#ec4899"/> AI Risk Factors</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1f4a" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={{ background: '#0f0a1f', border: '1px solid #2a1f4a', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={2} dot={false} name="High Risk" />
              <Line type="monotone" dataKey="medium" stroke="#f59e0b" strokeWidth={2} dot={false} name="Medium Risk" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map & Table Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Live Risk Map */}
        <div style={{ background: '#120c2b', borderRadius: '12px', border: '1px solid #2a1f4a', overflow: 'hidden', height: '450px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a1f4a', display: 'flex', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={18} color="#10b981"/> Live Risk Map</h3>
            <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{width: 8, height: 8, borderRadius: '50%', background: '#10b981'}}></span> ONLINE</span>
          </div>
          <div style={{ flex: 1 }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={{ lat: alerts[0]?.location?.latitude || 12.9716, lng: alerts[0]?.location?.longitude || 77.5946 }}
                zoom={12}
                options={{
                  styles: [
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                  ],
                  disableDefaultUI: true
                }}
              >
                {/* Live Users */}
                {Object.values(liveUsers).map((user: any) => (
                  <Marker 
                    key={user.user_id} 
                    position={{ lat: user.latitude, lng: user.longitude }}
                    icon={{ path: window.google?.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#3b82f6', fillOpacity: 1, strokeWeight: 1, strokeColor: '#fff' }}
                  />
                ))}
                {/* Active SOS & Danger Zones */}
                {alerts.map((a: any) => (
                  <React.Fragment key={a.id}>
                    <Marker 
                      position={{ lat: a.location?.latitude || 0, lng: a.location?.longitude || 0 }}
                      icon={{ path: window.google?.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#ef4444', fillOpacity: 1, strokeWeight: 2, strokeColor: '#fff' }}
                    />
                    <Circle 
                      center={{ lat: a.location?.latitude || 0, lng: a.location?.longitude || 0 }}
                      radius={1000}
                      options={{ fillColor: '#ef4444', fillOpacity: 0.2, strokeColor: '#ef4444', strokeOpacity: 0.5, strokeWeight: 1 }}
                    />
                  </React.Fragment>
                ))}
              </GoogleMap>
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Map...</div>
            )}
          </div>
        </div>

        {/* Active SOS Table */}
        <div style={{ background: '#120c2b', borderRadius: '12px', border: '1px solid #2a1f4a', overflow: 'hidden', height: '450px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a1f4a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18} color="#ef4444"/> Active SOS Emergencies</h3>
            <span style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}>{alerts.length} ACTIVE</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>User</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>Risk</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>Location</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>Time</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: '#94a3b8' }}>Intel</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                   <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No active emergencies.</td></tr>
                ) : (
                  alerts.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px' }}>{a.user_name || 'Anonymous'}</td>
                      <td style={{ padding: '12px 16px', color: '#ef4444', fontWeight: 700 }}>{a.severity?.toUpperCase()}</td>
                      <td style={{ padding: '12px 16px' }}>{a.location?.district || 'Unknown'}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{new Date(a.created_at).toLocaleTimeString()}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ color: '#f59e0b', fontSize: '11px', border: '1px solid #f59e0b', padding: '2px 6px', borderRadius: '4px' }}>UNRESOLVED</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => handleViewIntel(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                          <Eye size={14}/> View Intel
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Real-time Comprehensive Alert Intelligence Panel */}
      <AnimatePresence>
        {selectedAlertId && (
          <AlertIntelligencePanel
            alertId={selectedAlertId}
            onClose={() => setSelectedAlertId(null)}
            onResolve={handleResolveAlert}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════ ERROR BOUNDARY ═══════════════════════ */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Dashboard caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "100%", background: "#0a0514", padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #2a1f4a', padding: 32, borderRadius: 16, maxWidth: 500, textAlign: 'center' }}>
            <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
            <h2 style={{ color: '#f8fafc', fontSize: 20, marginBottom: 12 }}>Dashboard Module Offline</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>{this.state.error?.message || "An unexpected error occurred while loading the Dashboard."}</p>
            <button onClick={() => window.location.reload()} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Dashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
