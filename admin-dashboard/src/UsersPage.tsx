import React, { useEffect, useState, useCallback } from 'react';
import { adminAPI } from './api';
import { Shield, Mail, Phone, Calendar, Edit2, Check, X } from 'lucide-react';
import { KARNATAKA_DIVISIONS, KARNATAKA_DISTRICTS } from './utils/constants';

export default function UsersPage() {
  const getInitial = () => {
    try {
      const cached = localStorage.getItem('page_cache_users');
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return [];
  };

  const [users, setUsers] = useState<any[]>(getInitial());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { 
      const r = await adminAPI.getUsers(); 
      const data = r.data || [];
      setUsers(data); 
      try { localStorage.setItem('page_cache_users', JSON.stringify(data)); } catch(e) {}
    } catch { 
      // Silently fail or keep cache
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) ||
                          u.email?.toLowerCase().includes(search.toLowerCase()) ||
                          u.phone?.includes(search);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const startEdit = (u: any) => {
    setEditingId(u.id);
    setEditForm({ name: u.name, phone: u.phone, role: u.role, is_active: u.is_active, division: u.division, district: u.district });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      await adminAPI.updateUser(id, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      alert("Failed to update user");
    }
    setSaving(false);
  };

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

      <div style={s.tabs}>
        <button 
          style={roleFilter === 'all' ? s.tabActive : s.tab} 
          onClick={() => setRoleFilter('all')}
        >All Users</button>
        <button 
          style={roleFilter === 'admin' ? s.tabActive : s.tab} 
          onClick={() => setRoleFilter('admin')}
        >Administrators</button>
        <button 
          style={roleFilter === 'user' ? s.tabActive : s.tab} 
          onClick={() => setRoleFilter('user')}
        >Regular Users</button>
      </div>

      <div style={s.grid}>
          {filtered.map(u => {
            const isEditing = editingId === u.id;
            return (
            <div key={u.id} className="glass-card" style={{ ...s.userCard, padding: 20 }}>
              <div style={s.cardTop}>
                <div style={s.avatar}>{u.name?.[0]?.toUpperCase() || '?'}</div>
                <div style={s.userInfo}>
                  {isEditing ? (
                    <input 
                      style={s.editInput} 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                    />
                  ) : (
                    <p style={s.name}>{u.name}</p>
                  )}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select 
                        style={s.editSelect}
                        value={editForm.role}
                        onChange={e => setEditForm({...editForm, role: e.target.value})}
                      >
                        <option value="user">User</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="regional_admin">Regional Admin</option>
                        <option value="district_admin">District Admin</option>
                      </select>
                      {editForm.role === 'regional_admin' && (
                        <select style={s.editSelect} value={editForm.division || ''} onChange={e => setEditForm({...editForm, division: e.target.value, district: ''})}>
                          <option value="">Select Division</option>
                          {KARNATAKA_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                        </select>
                      )}
                      {editForm.role === 'district_admin' && (
                        <>
                          <select style={s.editSelect} value={editForm.division || ''} onChange={e => setEditForm({...editForm, division: e.target.value, district: ''})}>
                            <option value="">Select Division</option>
                            {KARNATAKA_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                          </select>
                          <select style={s.editSelect} value={editForm.district || ''} onChange={e => setEditForm({...editForm, district: e.target.value})} disabled={!editForm.division}>
                            <option value="">Select District</option>
                            {(KARNATAKA_DISTRICTS[editForm.division] || []).map((dist: string) => (
                              <option key={dist} value={dist}>{dist}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className={`badge ${['admin', 'super_admin', 'regional_admin', 'district_admin'].includes(u.role) ? 'badge-critical' : 'badge-safe'}`}>
                      {['admin', 'super_admin', 'regional_admin', 'district_admin'].includes(u.role) && <Shield size={10} />} {u.role} {u.division ? `(${u.division})` : u.district ? `(${u.district})` : ''}
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <select 
                    style={{...s.editSelect, position: 'absolute', top: 0, right: 0}}
                    value={editForm.is_active ? 'true' : 'false'}
                    onChange={e => setEditForm({...editForm, is_active: e.target.value === 'true'})}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                ) : (
                  <div style={{ ...s.activeDot,
                    background: u.is_active ? '#10b981' : '#ef4444' }} />
                )}
              </div>
              <div style={s.details}>
                <div style={s.detailRow}><Mail size={13} color="#6b5a8a" /><span>{u.email || 'No email'}</span></div>
                <div style={s.detailRow}>
                  <Phone size={13} color="#6b5a8a" />
                  {isEditing ? (
                    <input 
                      style={s.editInput} 
                      value={editForm.phone}
                      onChange={e => setEditForm({...editForm, phone: e.target.value})}
                    />
                  ) : (
                    <span>{u.phone}</span>
                  )}
                </div>
                <div style={s.detailRow}>
                  <Calendar size={13} color="#6b5a8a" />
                  <span>Joined {new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {isEditing ? (
                  <>
                    <button onClick={() => saveEdit(u.id)} disabled={saving} style={{...s.actionBtn, background: '#10b981'}}>
                      <Check size={14} color="#fff" />
                    </button>
                    <button onClick={cancelEdit} disabled={saving} style={{...s.actionBtn, background: '#ef4444'}}>
                      <X size={14} color="#fff" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => startEdit(u)} style={{...s.actionBtn, background: '#8b5cf6'}}>
                    <Edit2 size={12} color="#fff" /> <span style={{fontSize: 12}}>Edit</span>
                  </button>
                )}
              </div>
            </div>
          )})}
          {filtered.length === 0 && (
            <p style={{ color:'#6b5a8a', gridColumn:'1/-1', textAlign:'center', padding:40 }}>
              No users found
            </p>
          )}
        </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { flex:1, padding:28, overflowY:'auto', maxHeight:'100vh' },
  topbar: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 },
  title: { fontSize:24, fontWeight:800, color:'#f8f4ff' },
  sub: { fontSize:12, color:'#6b5a8a', marginTop:2 },
  search: { width:260 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tab: { padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: '#b8a9d9', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' },
  tabActive: { padding: '8px 16px', borderRadius: 8, background: '#8b5cf6', color: '#fff', border: '1px solid #8b5cf6', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' },
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
  editInput: { background: 'rgba(255,255,255,0.1)', border: '1px solid #8b5cf6', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 13, outline: 'none', width: '100%' },
  editSelect: { background: '#2d1b4e', border: '1px solid #8b5cf6', color: '#fff', padding: '2px 4px', borderRadius: 4, fontSize: 12, outline: 'none' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600 },
};
