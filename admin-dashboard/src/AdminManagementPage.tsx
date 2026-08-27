import React, { useState, useEffect } from 'react';
import { adminAPI } from './api';
import { Shield, Plus, Power, Key, List, Activity, AlertCircle, Copy, Check, Trash2 } from 'lucide-react';
import { useAdminAuth } from './AuthContext';
import { KARNATAKA_DIVISIONS, KARNATAKA_DISTRICTS } from './utils/constants';
import './AlertsPage.css';

export default function AdminManagementPage() {
  const { user } = useAdminAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'logs'>('list');
  const [admins, setAdmins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Form State
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({
    admin_id: '', password: '', name: '', email: '', phone: '', role: 'district_admin', division: '', district: ''
  });
  const [newAdminCreds, setNewAdminCreds] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeTab === 'list') fetchAdmins();
    else fetchLogs();
  }, [activeTab]);

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.listAdmins();
      setAdmins(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAdminLogs(100);
      setLogs(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await adminAPI.createAdmin(createData);
      setNewAdminCreds({ id: createData.admin_id, password: createData.password });
      setCreateData({ admin_id: '', password: '', name: '', email: '', phone: '', role: 'district_admin', division: '', district: '' });
      fetchAdmins();
    } catch (e: any) {
      let errorMsg = "Failed to create admin";
      if (e?.response?.data?.detail) {
        if (Array.isArray(e.response.data.detail)) {
          errorMsg = e.response.data.detail.map((err: any) => `${err.loc[err.loc.length - 1] || 'Field'}: ${err.msg}`).join('\n');
        } else if (typeof e.response.data.detail === 'string') {
          errorMsg = e.response.data.detail;
        }
      }
      alert(errorMsg);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this admin?`)) return;
    try {
      await adminAPI.changeAdminStatus(id, !currentStatus);
      fetchAdmins();
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleResetPassword = async (id: string) => {
    const newPass = window.prompt("Enter the new password for this admin:");
    if (!newPass) return;
    if (newPass.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }
    if (!window.confirm("Are you absolutely sure you want to reset this admin's password to the one you just entered?")) return;
    try {
      await adminAPI.resetAdminPassword(id, newPass);
      alert(`Password reset successfully. Please share the new password with the admin securely.`);
    } catch (e) {
      alert("Failed to reset password");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("CRITICAL WARNING: Are you absolutely sure you want to permanently delete this admin? This action cannot be undone.")) return;
    try {
      await adminAPI.deleteAdmin(id);
      fetchAdmins();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Failed to delete admin");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    return (
      <div style={{ padding: 40, color: '#fff', textAlign: 'center' }}>
        <Shield size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h2>Access Restricted</h2>
        <p style={{ color: '#94a3b8' }}>Only State Admins can access this console.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontSize: 24, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield color="#8b5cf6" /> Admin Management
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>Manage regional and district personnel securely</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setActiveTab('list')}
            style={{ ...s.tabBtn, background: activeTab === 'list' ? '#2a1f4a' : 'transparent', color: activeTab === 'list' ? '#fff' : '#94a3b8' }}
          >
            <List size={16} /> Admins List
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            style={{ ...s.tabBtn, background: activeTab === 'logs' ? '#2a1f4a' : 'transparent', color: activeTab === 'logs' ? '#fff' : '#94a3b8' }}
          >
            <Activity size={16} /> Activity Logs
          </button>
        </div>
      </div>

      {activeTab === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button onClick={() => { setShowCreate(!showCreate); setNewAdminCreds(null); }} style={s.createBtn}>
              <Plus size={18} /> {showCreate ? 'Close Form' : 'Create New Admin'}
            </button>
          </div>

          {showCreate && (
            <div style={s.card}>
              <h3 style={{ color: '#fff', marginTop: 0, marginBottom: 20 }}>Create Administrator</h3>
              {newAdminCreds ? (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: 20, borderRadius: 12 }}>
                  <h4 style={{ color: '#10b981', marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={20} /> Admin Created Successfully
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <div style={{ color: '#fff' }}><strong>Admin ID:</strong> {newAdminCreds.id}</div>
                    <div style={{ color: '#fff' }}><strong>Temp Password:</strong> <code style={{ background: '#000', padding: '4px 8px', borderRadius: 4, letterSpacing: 1 }}>{newAdminCreds.password}</code></div>
                  </div>
                  <button onClick={() => copyToClipboard(`ID: ${newAdminCreds.id}\nPass: ${newAdminCreds.password}`)} style={s.copyBtn}>
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied!' : 'Copy Credentials'}
                  </button>
                  <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 16, marginBottom: 0 }}>Please share these securely. The user will be required to change this password on first login.</p>
                </div>
              ) : (
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div style={s.field}><label style={s.label}>Admin ID</label><input required style={s.input} value={createData.admin_id} onChange={e => setCreateData({...createData, admin_id: e.target.value})} placeholder="e.g. DIST-1234" /></div>
                  <div style={s.field}><label style={s.label}>Temporary Password</label><input required type="text" minLength={6} style={s.input} value={createData.password} onChange={e => setCreateData({...createData, password: e.target.value})} /></div>
                  <div style={s.field}><label style={s.label}>Full Name</label><input required style={s.input} value={createData.name} onChange={e => setCreateData({...createData, name: e.target.value})} /></div>
                  <div style={s.field}><label style={s.label}>Email</label><input required type="email" style={s.input} value={createData.email} onChange={e => setCreateData({...createData, email: e.target.value})} /></div>
                  <div style={s.field}><label style={s.label}>Phone Number</label><input required style={s.input} value={createData.phone} onChange={e => setCreateData({...createData, phone: e.target.value})} /></div>
                  <div style={s.field}>
                    <label style={s.label}>Admin Role</label>
                    <select style={s.input} value={createData.role} onChange={e => setCreateData({...createData, role: e.target.value})}>
                      <option value="district_admin">District Admin</option>
                      <option value="regional_admin">Division Admin</option>
                      <option value="admin">State Admin</option>
                    </select>
                  </div>
                  {createData.role === 'regional_admin' && (
                    <div style={s.field}>
                      <label style={s.label}>Division</label>
                      <select required style={s.input} value={createData.division} onChange={e => setCreateData({...createData, division: e.target.value, district: ''})}>
                        <option value="">Select Division</option>
                        {KARNATAKA_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                      </select>
                    </div>
                  )}
                  {createData.role === 'district_admin' && (
                    <>
                      <div style={s.field}>
                        <label style={s.label}>Division</label>
                        <select required style={s.input} value={createData.division} onChange={e => setCreateData({...createData, division: e.target.value, district: ''})}>
                          <option value="">Select Division First</option>
                          {KARNATAKA_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                        </select>
                      </div>
                      <div style={s.field}>
                        <label style={s.label}>District</label>
                        <select required style={s.input} value={createData.district} onChange={e => setCreateData({...createData, district: e.target.value})} disabled={!createData.division}>
                          <option value="">Select District</option>
                          {(KARNATAKA_DISTRICTS[createData.division] || []).map((dist: string) => (
                            <option key={dist} value={dist}>{dist}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div style={{ gridColumn: '1 / -1', marginTop: 10 }}>
                    <button type="submit" style={s.submitBtn}>Create Administrator</button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div style={s.tableContainer}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>ID & Name</th>
                  <th style={s.th}>Role / Region</th>
                  <th style={s.th}>Contact</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id} style={s.tr}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: '#8b5cf6' }}>{a.admin_id || a.id.slice(0, 8)}</div>
                    </td>
                    <td style={s.td}>
                      <div style={{ color: '#cbd5e1' }}>{a.role.replace('_', ' ').toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {a.role === 'district_admin' ? a.district : a.role === 'regional_admin' ? a.division : 'Statewide'}
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={{ color: '#cbd5e1' }}>{a.email}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.phone}</div>
                    </td>
                    <td style={s.td}>
                      <span style={{ 
                        padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: a.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: a.is_active ? '#10b981' : '#ef4444' 
                      }}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleToggleStatus(a.id, a.is_active)} style={{...s.actionBtn, background: 'rgba(239,68,68,0.1)', color: '#ef4444'}} title={a.is_active ? 'Deactivate' : 'Activate'}>
                          <Power size={16} />
                        </button>
                        <button onClick={() => handleResetPassword(a.id)} style={{...s.actionBtn, background: 'rgba(59,130,246,0.1)', color: '#3b82f6'}} title="Reset Password">
                          <Key size={16} />
                        </button>
                        <button onClick={() => handleDelete(a.id)} style={{...s.actionBtn, background: 'rgba(239,68,68,0.1)', color: '#ef4444'}} title="Delete Admin">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div style={s.card}>
          <h3 style={{ color: '#fff', marginTop: 0, marginBottom: 20 }}>Activity Logs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {logs.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', gap: 16, padding: '16px', background: 'var(--bg-lighter)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ background: 'rgba(139,92,246,0.1)', padding: 10, borderRadius: '50%', height: 'fit-content' }}>
                  <AlertCircle size={20} color="#8b5cf6" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>{l.admin_email}</span>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>performed</span>
                    <span style={{ color: '#3b82f6', fontWeight: 600, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{l.action}</span>
                  </div>
                  {l.details && <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 4 }}>{l.details}</div>}
                  <div style={{ color: '#64748b', fontSize: 12 }}>{new Date(l.created_at).toLocaleString()} | Target ID: {l.target_id || 'N/A'}</div>
                </div>
              </div>
            ))}
            {logs.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No logs found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  tabBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  createBtn: {
    background: '#8b5cf6',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    cursor: 'pointer',
  },
  card: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  field: { display: 'flex', flexDirection: 'column' as 'column', gap: 6 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  input: {
    background: 'var(--bg-lighter)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 14px',
    color: '#fff',
    outline: 'none',
  },
  submitBtn: {
    background: '#10b981',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: 8,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  copyBtn: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableContainer: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' as 'collapse' },
  th: {
    textAlign: 'left' as 'left',
    padding: '16px 24px',
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'uppercase' as 'uppercase',
    fontWeight: 700,
    borderBottom: '1px solid var(--border)',
    background: 'rgba(0,0,0,0.2)',
  },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '16px 24px', verticalAlign: 'middle' as 'middle' },
  actionBtn: {
    border: 'none',
    padding: 8,
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
