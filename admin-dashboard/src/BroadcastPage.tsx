import React, { useState, useEffect } from "react";
import { broadcastAPI } from "./api";
import { Radio, AlertTriangle, Send, CheckCircle, Clock, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function BroadcastPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    type: "alert",
    priority: "high",
    target_type: "all",
    target_location: "",
    scheduled_for: "",
    image: null as File | null,
  });

  const karnatakaDistricts = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", 
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", 
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", 
    "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", 
    "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"
  ];

  const loadHistory = async () => {
    try {
      const res = await broadcastAPI.getHistory();
      setHistory(res.data);
    } catch (err: any) {
      setError("Failed to load broadcast history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const payload = new FormData();
      payload.append("title", formData.title);
      payload.append("body", formData.body);
      payload.append("type", formData.type);
      payload.append("priority", formData.priority);
      payload.append("target_type", formData.target_type);
      
      if (formData.target_type !== "all" && formData.target_location) {
        payload.append("target_location", formData.target_location);
      }
      
      if (formData.scheduled_for) {
        payload.append("scheduled_for", new Date(formData.scheduled_for).toISOString());
      }
      
      if (formData.image) {
        payload.append("image", formData.image);
      }

      await broadcastAPI.create(payload);
      setSuccess("Emergency broadcast initiated successfully.");
      setFormData({
        title: "",
        body: "",
        type: "alert",
        priority: "high",
        target_type: "all",
        target_location: "",
        scheduled_for: "",
        image: null,
      });
      loadHistory();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to initiate broadcast.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;
    try {
      await broadcastAPI.delete(id);
      loadHistory();
    } catch (err) {
      setError("Failed to delete broadcast.");
    }
  };

  return (
    <div style={{ flex: 1, padding: "32px", overflowY: "auto", background: "var(--bg-app)" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "12px" }}>
          <Radio color="#8b5cf6" size={32} /> Emergency Broadcast Center
        </h1>
        <p style={{ color: "#94a3b8", marginTop: "8px" }}>Dispatch urgent alerts, advisories, and instructions to users network-wide.</p>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", padding: "12px 16px", borderRadius: "8px", color: "#ef4444", marginBottom: "20px" }}>{error}</div>}
      {success && <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", padding: "12px 16px", borderRadius: "8px", color: "#10b981", marginBottom: "20px" }}>{success}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Composer */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Send size={18} /> Compose Broadcast
          </h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" required style={inputStyle} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. SEVERE WEATHER WARNING" />
            </div>
            <div>
              <label style={labelStyle}>Message Body</label>
              <textarea required style={{...inputStyle, height: "100px", resize: "none"}} value={formData.body} onChange={e => setFormData({...formData, body: e.target.value})} placeholder="Provide detailed instructions..." />
            </div>
            <div>
              <label style={labelStyle}>Attach Image (Optional)</label>
              <input type="file" accept="image/*" style={inputStyle} onChange={e => setFormData({...formData, image: e.target.files ? e.target.files[0] : null})} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                  <option value="alert">Alert</option>
                  <option value="advisory">Advisory</option>
                  <option value="weather">Weather</option>
                  <option value="missing">Missing Person</option>
                  <option value="instruction">Instruction</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select style={inputStyle} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Target Audience</label>
                <select style={inputStyle} value={formData.target_type} onChange={e => setFormData({...formData, target_type: e.target.value})}>
                  <option value="all">All Users Network-wide</option>
                  <option value="location">Specific Location</option>
                </select>
              </div>
              {formData.target_type === "location" && (
                <div>
                  <label style={labelStyle}>District / Division</label>
                  <select required style={inputStyle} value={formData.target_location} onChange={e => setFormData({...formData, target_location: e.target.value})}>
                    <option value="" disabled>Select District</option>
                    {karnatakaDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Schedule (Optional - leave blank for immediate)</label>
              <input type="datetime-local" style={inputStyle} value={formData.scheduled_for} onChange={e => setFormData({...formData, scheduled_for: e.target.value})} />
            </div>
            
            <button type="submit" style={{ background: "#ef4444", color: "#fff", border: "none", padding: "14px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <AlertTriangle size={18} /> INITIATE EMERGENCY BROADCAST
            </button>
          </form>
        </motion.div>

        {/* History */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={18} /> Broadcast History
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "600px", overflowY: "auto" }}>
            {history.length === 0 ? (
              <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No broadcasts sent yet.</p>
            ) : (
              history.map(b => (
                <div key={b.id} style={{ padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <h4 style={{ fontWeight: 700, fontSize: "15px", color: b.priority === 'critical' ? '#ef4444' : '#fff' }}>{b.title}</h4>
                      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{new Date(b.created_at).toLocaleString()}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: 700, padding: "4px 8px", borderRadius: "4px", background: b.status === 'completed' ? '#10b98120' : '#f59e0b20', color: b.status === 'completed' ? '#10b981' : '#f59e0b' }}>
                        {b.status}
                      </span>
                      <button onClick={() => handleDelete(b.id)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", color: "#ef4444" }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "#cbd5e1", marginBottom: "12px" }}>{b.body}</p>
                  
                  <div style={{ display: "flex", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Send size={14} color="#8b5cf6" />
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Sent: <strong style={{ color: "#fff" }}>{b.delivery_stats?.sent || 0}</strong></span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle size={14} color="#10b981" />
                      <span style={{ fontSize: "12px", color: "#94a3b8" }}>Read: <strong style={{ color: "#fff" }}>{b.delivery_stats?.read || 0}</strong></span>
                    </div>
                    {b.target_type === 'location' && (
                      <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "auto", alignSelf: "center" }}>📍 {b.target_location}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "14px" };
