import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminAPI } from "./api";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Phone,
  ShieldAlert,
  X,
  Trash2,
} from "lucide-react";
import "./AlertsPage.css";

interface AlertLocation {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  lng?: number;
}

interface AlertAIAnalysis {
  danger_level?: string;
  reasoning?: string;
  ai_tactical_summary?: string;
  suggested_action?: string;
  recommendations?: string[];
}

interface AlertItem {
  id: string;
  status?: string;
  severity?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  created_at: string;
  location?: AlertLocation;
  ai_analysis?: AlertAIAnalysis;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getRecentAlerts(50);
      setAlerts(res.data || []);
    } catch (error) {
      console.error("Failed to load alerts", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await load();
    };
    initialize();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const handleResolve = async (id: string) => {
    if (!window.confirm("Mark this emergency as RESOLVED?")) return;
    try {
      await adminAPI.resolveAlert(id);
      load();
    } catch (error) {
      console.error("Failed to resolve alert", error);
      alert("Failed to resolve alert");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "⚠️ DANGER: PERMANENT DELETION ⚠️\n\nAre you absolutely sure you want to PERMANENTLY DELETE this emergency alert?\n\nThis will erase all incident logs, threat analytics, and maps records for this alert! This action CANNOT BE UNDONE!",
      )
    )
      return;
    try {
      await adminAPI.deleteAlert(id);
      setSelectedAlert(null);
      load();
    } catch (error) {
      console.error("Failed to permanently delete alert", error);
      alert("Failed to permanently delete alert");
    }
  };

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const normalizeCoords = (
    loc: AlertLocation | undefined,
  ): [number, number] | null => {
    if (!loc) return null;
    let lat = Number(loc.latitude ?? loc.lat ?? NaN);
    let lng = Number(loc.longitude ?? loc.lon ?? loc.lng ?? NaN);

    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    const latValid = lat >= -90 && lat <= 90;
    if (!latValid && lng >= -90 && lng <= 90 && lat >= -180 && lat <= 180) {
      const tmp = lat;
      lat = lng;
      lng = tmp;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  };

  if (loading)
    return (
      <div className="alerts-page__loader">
        SCANNING EMERGENCY FREQUENCIES...
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="alerts-page"
    >
      <AnimatePresence>
        {selectedAlert && (
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
            >
              <button
                onClick={() => setSelectedAlert(null)}
                className="alerts-page__close-button"
                aria-label="Close alert details"
                title="Close"
              >
                <X size={20} />
              </button>

              <div className="alerts-page__section-header">
                <div
                  className={`alerts-page__status-indicator ${
                    selectedAlert.status === "active"
                      ? "alerts-page__status-active"
                      : "alerts-page__status-resolved"
                  }`}
                />
                <div>
                  <h2 className="alerts-page__title">Intelligence Report</h2>
                  <p className="alerts-page__meta">
                    Reference ID: {selectedAlert.id}
                  </p>
                </div>
              </div>

              <div className="alerts-page__section-grid">
                <div className="alerts-page__info-box">
                  <p className="alerts-page__modal-label">Subject Personnel</p>
                  <p className="alerts-page__modal-value">
                    {selectedAlert.user_name || "N/A"}
                  </p>
                  <p className="alerts-page__modal-sub">
                    {selectedAlert.user_phone || "No phone data"}
                  </p>
                </div>
                <div className="alerts-page__info-box">
                  <p className="alerts-page__modal-label">Incident Timestamp</p>
                  <p className="alerts-page__modal-value">
                    {new Date(
                      selectedAlert.created_at +
                        (selectedAlert.created_at.endsWith("Z") ? "" : "Z"),
                    ).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                  <p className="alerts-page__modal-sub">
                    {new Date(
                      selectedAlert.created_at +
                        (selectedAlert.created_at.endsWith("Z") ? "" : "Z"),
                    ).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
              </div>

              <div className="alerts-page__ai-card">
                <div className="alerts-page__ai-top">
                  <p className="alerts-page__ai-label">
                    AI Safety Engine Analysis
                  </p>
                  <span
                    className={`alerts-page__risk-chip ${
                      selectedAlert.ai_analysis?.danger_level === "high"
                        ? "high"
                        : "normal"
                    }`}
                  >
                    RISK:{" "}
                    {selectedAlert.ai_analysis?.danger_level?.toUpperCase() ||
                      "UNKNOWN"}
                  </span>
                </div>
                <p className="alerts-page__ai-text">
                  {selectedAlert.ai_analysis?.reasoning ||
                    selectedAlert.ai_analysis?.ai_tactical_summary ||
                    "Analyzing incident patterns... No reasoning provided by AI engine."}
                </p>
                <div className="alerts-page__ai-footer">
                  <p className="alerts-page__ai-footer-label">
                    Recommended Response
                  </p>
                  <p className="alerts-page__ai-footer-text">
                    {selectedAlert.ai_analysis?.suggested_action ||
                      (selectedAlert.ai_analysis?.recommendations?.length
                        ? selectedAlert.ai_analysis.recommendations.join(" • ")
                        : "Deploy emergency units to coordinates immediately.")}
                  </p>
                </div>
              </div>

              <div className="alerts-page__action-row">
                <button
                  onClick={() => handleDelete(selectedAlert.id)}
                  className="alerts-page__action-button danger"
                >
                  <Trash2 size={16} /> DELETE
                </button>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="alerts-page__action-button secondary"
                >
                  CLOSE
                </button>
                <button
                  onClick={() => {
                    const normalized = normalizeCoords(selectedAlert.location);
                    if (!normalized) {
                      alert("Location data appears invalid for this alert.");
                      return;
                    }
                    const [lat, lng] = normalized;
                    window.open(`https://www.google.com/maps?q=${lat},${lng}`);
                  }}
                  className="alerts-page__locate-button"
                >
                  LOCATE SOURCE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="alerts-page__header-row">
        <div>
          <h1 className="alerts-page__header-title">Emergency Management</h1>
          <p className="alerts-page__header-subtitle">
            Real-time SOS interception and response console.
          </p>
        </div>
        <div className="alerts-page__filters">
          <select
            className="alerts-page__select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter alerts"
          >
            <option value="all">All Alerts</option>
            <option value="active">Active Only</option>
            <option value="resolved">Resolved</option>
          </select>
          <button onClick={load} className="alerts-page__refresh">
            REFRESH
          </button>
        </div>
      </div>

      <div className="alerts-page__list">
        {filtered.length === 0 ? (
          <div className="glass-card alerts-page__empty-state">
            <ShieldAlert size={64} className="alerts-page__empty-icon" />
            <p className="alerts-page__title">
              No active alerts in this sector.
            </p>
          </div>
        ) : (
          filtered.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card alerts-page__alert-card ${alert.status === "active" ? "active" : ""}`}
            >
              <div className="alerts-page__alert-inner">
                <div className="alerts-page__alert-left">
                  <div
                    className={`alerts-page__alert-icon ${
                      alert.status === "active" ? "active" : "safe"
                    }`}
                  >
                    <AlertTriangle
                      size={32}
                      color={alert.status === "active" ? "#ef4444" : "#64748b"}
                    />
                  </div>
                  <div className="alerts-page__alert-meta">
                    <div className="alerts-page__alert-row">
                      <h3 className="alerts-page__alert-title">
                        {alert.user_name || "Anonymous User"}
                      </h3>
                      <div className="alerts-page__alert-tags">
                        <span className={`badge badge-${alert.severity}`}>
                          {alert.severity}
                        </span>
                        {alert.status === "resolved" && (
                          <span className="badge alerts-page__status-flag">
                            RESOLVED
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="alerts-page__info-row">
                      <div className="alerts-page__info-item">
                        <User size={14} />{" "}
                        <span>{alert.user_email || "N/A"}</span>
                      </div>
                      <div className="alerts-page__info-item">
                        <Phone size={14} />{" "}
                        <span>{alert.user_phone || "N/A"}</span>
                      </div>
                      <div className="alerts-page__info-item">
                        <Clock size={14} />
                        <span>
                          {new Date(
                            alert.created_at +
                              (alert.created_at.endsWith("Z") ? "" : "Z"),
                          ).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="alerts-page__button-row">
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="alerts-page__delete-button"
                    title="Permanently Delete Alert"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={() => setSelectedAlert(alert)}
                    className="alerts-page__card-button glass-card"
                  >
                    VIEW INTEL
                  </button>
                  {alert.status === "active" && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="alerts-page__resolve-button"
                    >
                      <CheckCircle size={18} /> RESOLVE
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
