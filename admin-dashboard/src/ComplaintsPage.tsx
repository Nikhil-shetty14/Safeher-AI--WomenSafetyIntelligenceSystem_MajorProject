import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminAPI } from "./api";
import {
  FileText,
  Clock,
  CheckCircle,
  MapPin,
  X,
  PlaySquare,
  Volume2,
  ImageIcon,
  Trash2
} from "lucide-react";
import "./AlertsPage.css";

interface LocationData {
  latitude: number;
  longitude: number;
}

interface UserDetails {
  name: string;
  email: string;
  phone: string;
}

interface Complaint {
  id: string;
  user_id: string;
  state: string;
  district: string;
  taluk: string;
  address: string;
  title: string;
  description: string;
  media_urls: string[];
  location?: LocationData;
  status: string;
  admin_remarks?: string;
  user_details?: UserDetails;
  created_at: string;
  updated_at: string;
}

export default function ComplaintsPage() {
  const getInitial = () => {
    try {
      const cached = localStorage.getItem('page_cache_complaints');
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return [];
  };

  const [complaints, setComplaints] = useState<Complaint[]>(getInitial());
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [filter, setFilter] = useState("all");
  const [remarks, setRemarks] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getComplaints();
      const data = res.data || [];
      setComplaints(data);
      try { localStorage.setItem('page_cache_complaints', JSON.stringify(data)); } catch(e) {}
    } catch (error) {
      console.error("Failed to load complaints", error);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // 60s background sync
    return () => clearInterval(t);
  }, [load]);

  const handleUpdateStatus = async (status: string) => {
    if (!selectedComplaint) return;
    try {
      await adminAPI.updateComplaint(selectedComplaint.id, {
        status,
        admin_remarks: remarks
      });
      setSelectedComplaint(null);
      setRemarks("");
      load();
    } catch (error) {
      console.error("Failed to update complaint", error);
      alert("Failed to update complaint");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete this complaint and its evidence?")) return;
    try {
      await adminAPI.deleteComplaint(id);
      if (selectedComplaint?.id === id) {
        setSelectedComplaint(null);
      }
      load();
    } catch (error) {
      console.error("Failed to delete complaint", error);
      alert("Failed to delete complaint");
    }
  };

  const filtered = complaints.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });


  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="alerts-page"
    >
      <AnimatePresence>
        {selectedComplaint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="alerts-page__detail-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card alerts-page__detail-panel"
              style={{ maxHeight: '90vh', overflowY: 'auto' }}
            >
              <button
                onClick={() => setSelectedComplaint(null)}
                className="alerts-page__close-button"
              >
                <X size={20} />
              </button>

              <div className="alerts-page__section-header">
                <div>
                  <h2 className="alerts-page__title">{selectedComplaint.title}</h2>
                  <p className="alerts-page__meta">ID: {selectedComplaint.id} | Status: {selectedComplaint.status}</p>
                </div>
              </div>

              <div className="alerts-page__section-grid">
                <div className="alerts-page__info-box">
                  <p className="alerts-page__modal-label">Complainant Info</p>
                  <p className="alerts-page__modal-value" style={{ color: '#8b5cf6' }}>{selectedComplaint.user_details?.name || 'Unknown User'}</p>
                  <p className="alerts-page__modal-sub">{selectedComplaint.user_details?.email}</p>
                  <p className="alerts-page__modal-sub">{selectedComplaint.user_details?.phone}</p>
                </div>
                <div className="alerts-page__info-box">
                  <p className="alerts-page__modal-label">Location</p>
                  <p className="alerts-page__modal-value">{selectedComplaint.state}, {selectedComplaint.district}</p>
                  <p className="alerts-page__modal-sub">{selectedComplaint.taluk}</p>
                  <p className="alerts-page__modal-sub">{selectedComplaint.address}</p>
                </div>
                <div className="alerts-page__info-box">
                  <p className="alerts-page__modal-label">Date Submitted</p>
                  <p className="alerts-page__modal-value">
                    {new Date(selectedComplaint.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="alerts-page__ai-card">
                <p className="alerts-page__ai-label">Description</p>
                <p className="alerts-page__ai-text">{selectedComplaint.description}</p>
              </div>

              {selectedComplaint.media_urls && selectedComplaint.media_urls.length > 0 && (
                <div className="alerts-page__ai-card" style={{ marginTop: 15 }}>
                  <p className="alerts-page__ai-label">Evidence Media</p>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: 10 }}>
                    {selectedComplaint.media_urls.map((url, i) => {
                       const fullUrl = `${BASE_URL}${url}`;
                       const ext = url.split('.').pop()?.toLowerCase();
                       if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
                         return <img key={i} src={fullUrl} alt="evidence" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }} />;
                       }
                       if (['mp4', 'mov'].includes(ext || '')) {
                         return <video key={i} src={fullUrl} controls style={{ width: 200, height: 100, borderRadius: 8 }} />;
                       }
                       if (['m4a', 'wav', 'mp3'].includes(ext || '')) {
                         return <audio key={i} src={fullUrl} controls style={{ width: 200 }} />;
                       }
                       return <a key={i} href={fullUrl} target="_blank">View File</a>;
                    })}
                  </div>
                </div>
              )}

              <div className="alerts-page__ai-card" style={{ marginTop: 15 }}>
                <p className="alerts-page__ai-label">Admin Actions</p>
                <textarea 
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Enter remarks/notes here..."
                  style={{ width: '100%', minHeight: 80, marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>

              <div className="alerts-page__action-row" style={{ marginTop: 20 }}>
                {selectedComplaint.status !== 'Resolved' && (
                  <button onClick={() => handleUpdateStatus("Resolved")} className="alerts-page__resolve-button">
                    <CheckCircle size={16} /> Mark Resolved
                  </button>
                )}
                {selectedComplaint.status === 'Pending' && (
                  <button onClick={() => handleUpdateStatus("Under Review")} className="alerts-page__action-button secondary">
                    Mark Under Review
                  </button>
                )}
                {selectedComplaint.location && (
                  <button
                    onClick={() => {
                      const { latitude, longitude } = selectedComplaint.location!;
                      window.open(`https://www.google.com/maps?q=${latitude},${longitude}`);
                    }}
                    className="alerts-page__locate-button"
                  >
                    <MapPin size={16}/> View on Map
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="alerts-page__header-row">
        <div>
          <h1 className="alerts-page__header-title">Complaint Management</h1>
          <p className="alerts-page__header-subtitle">
            Review and act on user-submitted complaints and evidence.
          </p>
        </div>
        <div className="alerts-page__filters">
          <select
            className="alerts-page__select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Complaints</option>
            <option value="Pending">Pending</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
          </select>
          <button onClick={load} className="alerts-page__refresh">
            REFRESH
          </button>
        </div>
      </div>

      <div className="alerts-page__list">
        {filtered.length === 0 ? (
          <div className="glass-card alerts-page__empty-state">
            <FileText size={64} className="alerts-page__empty-icon" />
            <p className="alerts-page__title">No complaints found.</p>
          </div>
        ) : (
          filtered.map((complaint, index) => (
            <motion.div
              key={complaint.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card alerts-page__alert-card`}
            >
              <div className="alerts-page__alert-inner">
                <div className="alerts-page__alert-left">
                  <div className={`alerts-page__alert-icon ${complaint.status === 'Resolved' ? 'safe' : 'active'}`}>
                    <FileText size={32} color={complaint.status === 'Resolved' ? '#10b981' : '#f59e0b'} />
                  </div>
                  <div className="alerts-page__alert-meta">
                    <div className="alerts-page__alert-row">
                      <h3 className="alerts-page__alert-title">{complaint.title}</h3>
                      <div className="alerts-page__alert-tags">
                        <span className="badge badge-medium">{complaint.status}</span>
                      </div>
                    </div>
                    <div className="alerts-page__info-row" style={{ marginTop: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#8b5cf6', fontWeight: 600 }}>{complaint.user_details?.name || 'Unknown User'}</span>
                    </div>
                    <div className="alerts-page__info-row">
                      <div className="alerts-page__info-item">
                        <MapPin size={14} /> <span>{complaint.district}, {complaint.state}</span>
                      </div>
                      <div className="alerts-page__info-item">
                        <Clock size={14} />
                        <span>{new Date(complaint.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="alerts-page__button-row" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                       setSelectedComplaint(complaint);
                       setRemarks(complaint.admin_remarks || "");
                    }}
                    className="alerts-page__card-button glass-card"
                  >
                    REVIEW DETAILS
                  </button>
                  <button
                    onClick={() => handleDelete(complaint.id)}
                    className="alerts-page__card-button glass-card"
                    style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                    title="Delete Complaint"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
