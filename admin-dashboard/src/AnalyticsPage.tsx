import React, { useEffect, useState } from 'react';
import { adminAPI } from './api';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#ef4444','#f59e0b','#8b5cf6','#10b981','#06b6d4'];
const PIE_DATA = [
  { name:'Critical', value:5 },{ name:'High', value:18 },
  { name:'Medium', value:32 },{ name:'Low', value:28 },{ name:'Safe', value:17 },
];

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    adminAPI.getDangerTrends().then(r => setTrends(r.data || [])).catch(() => {});
    adminAPI.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const radarData = [
    { subject:'SOS Alerts', A: stats?.total_alerts_today || 3 },
    { subject:'AI Predictions', A: Math.min((stats?.total_ai_predictions || 10), 40) },
    { subject:'Live Users', A: stats?.connected_users || 2 },
    { subject:'Critical', A: stats?.critical_alerts || 1 },
    { subject:'Resolved', A: (stats?.total_alerts_today || 3) - (stats?.active_alerts || 1) },
  ];

  return (
    <div style={s.page}>
      <h1 style={s.title}>📊 Analytics & Insights</h1>
      <p style={{ color:'#6b5a8a', marginBottom:28, fontSize:13 }}>
        AI-powered safety trend analysis across all monitored zones
      </p>

      <div style={s.row}>
        {/* Line chart */}
        <div className="card" style={{ flex:2 }}>
          <h3 style={s.cardTitle}>Danger Level Trend (7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trends.length ? trends : Array.from({length:7},(_,i)=>({
              date: new Date(Date.now()-(6-i)*86400000).toLocaleDateString('en',{weekday:'short'}),
              high: Math.floor(Math.random()*10), medium: Math.floor(Math.random()*20),
              low: Math.floor(Math.random()*15),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1f4a" />
              <XAxis dataKey="date" stroke="#6b5a8a" tick={{fontSize:11}} />
              <YAxis stroke="#6b5a8a" tick={{fontSize:11}} />
              <Tooltip contentStyle={{background:'#16102b',border:'1px solid #2a1f4a',borderRadius:8,color:'#f8f4ff'}} />
              <Legend wrapperStyle={{fontSize:12,color:'#b8a9d9'}} />
              <Line type="monotone" dataKey="high" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="medium" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="low" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <h3 style={{...s.cardTitle, marginBottom:16}}>Alert Severity Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false} style={{fontSize:10}}>
                {PIE_DATA.map((_,i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{background:'#16102b',border:'1px solid #2a1f4a',borderRadius:8,color:'#f8f4ff'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{...s.row, marginTop:20}}>
        {/* Radar */}
        <div className="card" style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center'}}>
          <h3 style={s.cardTitle}>System Activity Radar</h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2a1f4a" />
              <PolarAngleAxis dataKey="subject" tick={{fill:'#6b5a8a',fontSize:11}} />
              <Radar name="Activity" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
              <Tooltip contentStyle={{background:'#16102b',border:'1px solid #2a1f4a',borderRadius:8,color:'#f8f4ff'}} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* KPI cards */}
        <div className="card" style={{flex:1}}>
          <h3 style={s.cardTitle}>Key Performance Indicators</h3>
          <div style={{display:'flex', flexDirection:'column', gap:16, marginTop:12}}>
            {[
              { label:'Average Response Time', value:'< 30 sec', color:'#10b981', icon:'⚡' },
              { label:'SOS Alert Success Rate', value:'98.5%', color:'#8b5cf6', icon:'✅' },
              { label:'AI Detection Accuracy', value:'94.2%', color:'#f59e0b', icon:'🤖' },
              { label:'Emergency Contact Reach', value:'96.8%', color:'#06b6d4', icon:'📱' },
              { label:'False Alarm Rate', value:'3.1%', color:'#ec4899', icon:'⚠️' },
            ].map(k => (
              <div key={k.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'10px 14px', background:'#0d0920', borderRadius:10,
                borderLeft:`3px solid ${k.color}`}}>
                <span style={{fontSize:13, color:'#b8a9d9'}}>{k.icon} {k.label}</span>
                <span style={{fontSize:18, fontWeight:800, color:k.color}}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { flex:1, padding:28, overflowY:'auto', maxHeight:'100vh' },
  title: { fontSize:24, fontWeight:800, color:'#f8f4ff' },
  row: { display:'flex', gap:20 },
  cardTitle: { fontSize:15, fontWeight:700, color:'#f8f4ff', marginBottom:8 },
};
