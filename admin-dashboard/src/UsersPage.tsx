import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from './api';
import { Shield, Mail, Phone, Calendar } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminAPI.getUsers(); setUsers(r.data || []); }
    catch { setUsers([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div>
          <h1 style={s.title}>👥 User Management</h1>
          <p style={s.sub}>{users.length} registered users</p>
        </div>
        <input style={s.search} placeholder="🔍  Search users..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <p style={{ color:'#6b5a8a', padding:24 }}>Loading users...</p>
      ) : (
        <div style={s.grid}>
          {filtered.map(u => (
            <div key={u.id} className="card" style={s.userCard}>
              <div style={s.cardTop}>
                <div style={s.avatar}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                <div style={s.userInfo}>
                  <p style={s.name}>{u.name}</p>
                  <span className={`badge ${u.role === 'admin' ? 'badge-critical' : 'badge-safe'}`}>
                    {u.role === 'admin' && <Shield size={10} />} {u.role}
                  </span>
                </div>
                <div style={{ ...s.activeDot,
                  background: u.is_active ? '#10b981' : '#ef4444' }} />
              </div>
              <div style={s.details}>
                <div style={s.detailRow}><Mail size={13} color="#6b5a8a" /><span>{u.email}</span></div>
                <div style={s.detailRow}><Phone size={13} color="#6b5a8a" /><span>{u.phone}</span></div>
                <div style={s.detailRow}>
                  <Calendar size={13} color="#6b5a8a" />
                  <span>Joined {new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ color:'#6b5a8a', gridColumn:'1/-1', textAlign:'center', padding:40 }}>
              No users found
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { flex:1, padding:28, overflowY:'auto', maxHeight:'100vh' },
  topbar: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  title: { fontSize:24, fontWeight:800, color:'#f8f4ff' },
  sub: { fontSize:12, color:'#6b5a8a', marginTop:2 },
  search: { width:260 },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 },
  userCard: { transition:'transform 0.2s, box-shadow 0.2s', cursor:'default' },
  cardTop: { display:'flex', alignItems:'center', gap:12, marginBottom:16, position:'relative' },
  avatar: { width:48, height:48, borderRadius:24, background:'#8b5cf6',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:20, fontWeight:800, color:'#fff',
    boxShadow:'0 4px 12px rgba(139,92,246,0.3)', flexShrink:0 },
  userInfo: { flex:1, display:'flex', flexDirection:'column', gap:4 },
  name: { fontSize:15, fontWeight:700, color:'#f8f4ff' },
  activeDot: { width:10, height:10, borderRadius:5, position:'absolute', top:0, right:0 },
  details: { display:'flex', flexDirection:'column', gap:8 },
  detailRow: { display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#b8a9d9' },
};
