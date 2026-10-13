import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { adminAPI } from "./api";
import { useSocket } from "./SocketContext";
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
import AlertIntelligencePanel from "./components/AlertIntelligencePanel";
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
  acknowledged?: boolean;
}

export default function AlertsPage() {
  const getInitial = () => {
    try {
      const cached = localStorage.getItem('page_cache_alerts');
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return [];
  };

  const [alerts, setAlerts] = useState<AlertItem[]>(getInitial());
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [filter, setFilter] = useState("all");
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const alertIdParam = searchParams.get("alertId");

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getRecentAlerts(50);
      const data = res.data || [];
      setAlerts(data);
      try { localStorage.setItem('page_cache_alerts', JSON.stringify(data)); } catch(e) {}
    } catch (error) {
      console.error("Failed to load alerts", error);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // 30s background sync
    return () => clearInterval(t);
  }, [load]);

  // If navigated with alertId in URL (e.g. from instant popup "View SOS"), auto-select and auto-acknowledge
  useEffect(() => {
    if (!alertIdParam) return;
    const match = alerts.find(a => a.id === alertIdParam);
    if (match) {
      setSelectedAlert(match);
    } else {
      setSelectedAlert({
        id: alertIdParam,
        status: "active",
        created_at: new Date().toISOString(),
      });
    }
    adminAPI.acknowledgeAlert(alertIdParam).catch(() => {});
  }, [alertIdParam, alerts]);

  useEffect(() => {
    if (!socket) return;
    
    const handleNewAlert = (d: any) => {
      setAlerts(prev => {
        const id = d.alert_id || d.id;
        if (prev.find(a => a.id === id)) return prev;
        const newAlert = {
          id,
          user_id: d.user_id,
          user_name: d.user_name,
          user_phone: d.user_phone,
          severity: d.severity,
          location: d.location,
          status: 'active',
          acknowledged: false,
          created_at: d.location?.timestamp || d.created_at || new Date().toISOString()
        };
        const updated = [newAlert, ...prev];
        try { localStorage.setItem('page_cache_alerts', JSON.stringify(updated)); } catch(e) {}
        return updated;
      });
    };

    const handleAcknowledged = (d: any) => {
      const id = d.alert_id || d.id;
      if (!id) return;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    };

    const handleResolved = (d: any) => {
      const id = d.alert_id || d.id;
      if (!id) return;
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved', acknowledged: true } : a));
    };

    socket.on('new_sos_alert', handleNewAlert);
    socket.on('sos_alert_acknowledged', handleAcknowledged);
    socket.on('sos_alert_resolved', handleResolved);

    return () => {
      socket.off('new_sos_alert', handleNewAlert);
      socket.off('sos_alert_acknowledged', handleAcknowledged);
      socket.off('sos_alert_resolved', handleResolved);
    };
  }, [socket]);

  const handleAcknowledge = async (id: string) => {
    try {
      await adminAPI.acknowledgeAlert(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    } catch (error) {
      console.error("Failed to acknowledge alert", error);
    }
  };

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


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="alerts-page"
    >
      <AnimatePresence>
        {selectedAlert && (
          <AlertIntelligencePanel 
            alertId={selectedAlert.id} 
            onClose={() => setSelectedAlert(null)} 
            onResolve={handleResolve} 
          />
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
                        {alert.status === "active" && !alert.acknowledged && (
                          <span
                            className="badge"
                            style={{
                              background: alert.severity === "critical" ? "#ef4444" : "rgba(249, 115, 22, 0.2)",
                              color: alert.severity === "critical" ? "#ffffff" : "#fb923c",
                              border: `1px solid ${alert.severity === "critical" ? "#ef4444" : "rgba(249, 115, 22, 0.4)"}`,
                              fontWeight: 800,
                              letterSpacing: "0.5px",
                              boxShadow: alert.severity === "critical" ? "0 0 10px rgba(239, 68, 68, 0.6)" : "none",
                            }}
                          >
                            NEW
                          </span>
                        )}
                        {alert.status === "active" && alert.acknowledged && (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              fontWeight: 700,
                            }}
                          >
                            ACKNOWLEDGED
                          </span>
                        )}
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
                  {alert.status === "active" && !alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="alerts-page__card-button glass-card"
                      style={{ color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" }}
                      title="Acknowledge this emergency"
                    >
                      <CheckCircle size={15} /> ACK
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedAlert(alert);
                      handleAcknowledge(alert.id);
                    }}
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
