import React, { useState } from 'react';
import { useAdminAuth } from './AuthContext';

export default function LoginPage() {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try { await login(email, pass); }
    catch (e: any) { setErr(e?.response?.data?.detail || e?.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              fill="#8b5cf6" opacity="0.9"/>
          </svg>
        </div>
        <h1 style={styles.title}>SafeHer AI</h1>
        <p style={styles.sub}>Admin Control Center</p>
        <form onSubmit={handle} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="admin@safeher.ai" required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input style={styles.input} type="password" value={pass}
              onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          {err && <div style={styles.err}>⚠️ {err}</div>}
          <button style={{...styles.btn, opacity: loading ? 0.6 : 1}} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : '🔐 Sign In to Dashboard'}
          </button>
        </form>
        <p style={styles.hint}>Restricted to admin accounts only</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
    background:'linear-gradient(135deg,#0a0614 0%,#110d22 100%)' },
  card: { background:'#16102b', border:'1px solid #2a1f4a', borderRadius:24, padding:40,
    width:'100%', maxWidth:420, textAlign:'center',
    boxShadow:'0 20px 60px rgba(139,92,246,0.2)' },
  logo: { marginBottom:16, display:'flex', justifyContent:'center' },
  title: { fontSize:28, fontWeight:800, color:'#f8f4ff', margin:'0 0 4px' },
  sub: { color:'#b8a9d9', fontSize:14, marginBottom:32 },
  form: { textAlign:'left', display:'flex', flexDirection:'column', gap:16 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:12, color:'#b8a9d9', fontWeight:600 },
  input: { background:'#0a0614', border:'1px solid #2a1f4a', borderRadius:10,
    color:'#f8f4ff', padding:'12px 14px', fontSize:14, outline:'none', width:'100%' },
  err: { background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
    borderRadius:8, padding:'10px 14px', color:'#ef4444', fontSize:13 },
  btn: { background:'#8b5cf6', color:'#fff', border:'none', borderRadius:12, padding:'14px',
    fontSize:15, fontWeight:700, cursor:'pointer',
    boxShadow:'0 6px 20px rgba(139,92,246,0.4)', transition:'all 0.2s' },
  hint: { color:'#6b5a8a', fontSize:12, marginTop:20 },
};
