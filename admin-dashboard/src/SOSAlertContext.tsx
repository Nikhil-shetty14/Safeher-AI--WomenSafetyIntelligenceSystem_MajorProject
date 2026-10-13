import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { useAdminAuth } from "./AuthContext";
import { adminAPI } from "./api";
import { useNavigate } from "react-router-dom";

export interface SOSAlertLocation {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  accuracy?: number;
  address?: string;
  district?: string;
  division?: string;
  timestamp?: string;
}

export interface SOSAlertItem {
  id: string;
  alert_id?: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  user_email?: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "active" | "resolved" | "false_alarm";
  acknowledged?: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  location?: SOSAlertLocation;
  trigger_type?: string;
  message?: string;
  created_at: string;
  priority_score?: number;
}

export interface SOSPopupItem {
  id: string;
  alert: SOSAlertItem;
  dismissed: boolean;
  receivedAt: number;
}

interface SOSAlertContextType {
  unacknowledgedCount: number;
  criticalCount: number;
  unacknowledgedAlerts: SOSAlertItem[];
  popups: SOSPopupItem[];
  acknowledgeAlert: (alertId: string) => Promise<void>;
  dismissPopup: (alertId: string) => void;
  viewSOS: (alertId: string) => void;
  refreshCounts: () => Promise<void>;
}

const SOSAlertContext = createContext<SOSAlertContextType | null>(null);

export const SOSAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unacknowledgedCount, setUnacknowledgedCount] = useState<number>(0);
  const [criticalCount, setCriticalCount] = useState<number>(0);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState<SOSAlertItem[]>([]);
  const [popups, setPopups] = useState<SOSPopupItem[]>([]);

  const { socket } = useSocket();
  const { isAdmin, token } = useAdminAuth();
  const navigate = useNavigate();

  // Ref set to prevent duplicate popups and duplicate counter increments across socket events/reconnects
  const processedAlertIdsRef = useRef<Set<string>>(new Set());

  const playAlertSound = useCallback((severity: string) => {
    try {
      const audioUrl = severity === "critical"
        ? "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
        : "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
      const audio = new Audio(audioUrl);
      audio.volume = severity === "critical" ? 0.9 : 0.6;
      audio.play().catch(() => {});
    } catch (e) {
      // Browser autoplay policies may safely silence
    }
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!isAdmin || !token) return;
    try {
      const res = await adminAPI.getUnacknowledgedAlertsCount();
      if (res?.data) {
        setUnacknowledgedCount(Number(res.data.count) || 0);
        setCriticalCount(Number(res.data.critical_count) || 0);
      }
      const listRes = await adminAPI.getUnacknowledgedAlerts(50);
      if (listRes?.data && Array.isArray(listRes.data)) {
        setUnacknowledgedAlerts(listRes.data);
        listRes.data.forEach((a: SOSAlertItem) => {
          if (a.id) processedAlertIdsRef.current.add(a.id);
        });
      }
    } catch (err) {
      console.error("Failed to fetch unacknowledged SOS alert counts:", err);
    }
  }, [isAdmin, token]);

  // Initial fetch on login / mount
  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 30000); // Background sync every 30s
    return () => clearInterval(interval);
  }, [refreshCounts]);

  // Handle Real-time Socket.IO events
  useEffect(() => {
    if (!socket) return;

    const handleNewSOSAlert = (data: any) => {
      const alertId = data.alert_id || data.id || data._id;
      if (!alertId) return;

      // Duplicate prevention: If already seen, ignore duplicate socket emits
      if (processedAlertIdsRef.current.has(alertId)) {
        return;
      }
      processedAlertIdsRef.current.add(alertId);

      const severity = (data.severity || "high").toLowerCase() as "low" | "medium" | "high" | "critical";

      const newAlert: SOSAlertItem = {
        id: alertId,
        alert_id: alertId,
        user_id: data.user_id || "Unknown",
        user_name: data.user_name || "Emergency User",
        user_phone: data.user_phone,
        severity,
        status: "active",
        acknowledged: false,
        location: data.location || {},
        trigger_type: data.trigger_type || "manual",
        message: data.message,
        created_at: data.created_at || data.timestamp || new Date().toISOString(),
      };

      // Sound notification
      playAlertSound(severity);

      // Increment badge counters automatically
      setUnacknowledgedCount(prev => prev + 1);
      if (severity === "critical") {
        setCriticalCount(prev => prev + 1);
      }

      setUnacknowledgedAlerts(prev => [newAlert, ...prev.filter(a => a.id !== alertId)]);

      // Display instant popup notification (deduplicated)
      setPopups(prev => {
        const withoutDup = prev.filter(p => p.id !== alertId);
        return [
          {
            id: alertId,
            alert: newAlert,
            dismissed: false,
            receivedAt: Date.now(),
          },
          ...withoutDup,
        ].slice(0, 4); // Keep at most 4 active floating popups
      });
    };

    const handleAlertAcknowledged = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;

      // Dismiss popup
      setPopups(prev => prev.filter(p => p.id !== alertId));

      // Decrement counters
      setUnacknowledgedAlerts(prev => {
        const target = prev.find(a => a.id === alertId);
        if (target) {
          setUnacknowledgedCount(c => Math.max(0, c - 1));
          if (target.severity === "critical") {
            setCriticalCount(cc => Math.max(0, cc - 1));
          }
        }
        return prev.filter(a => a.id !== alertId);
      });
    };

    const handleAlertResolved = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;

      setPopups(prev => prev.filter(p => p.id !== alertId));

      setUnacknowledgedAlerts(prev => {
        const target = prev.find(a => a.id === alertId);
        if (target) {
          setUnacknowledgedCount(c => Math.max(0, c - 1));
          if (target.severity === "critical") {
            setCriticalCount(cc => Math.max(0, cc - 1));
          }
        }
        return prev.filter(a => a.id !== alertId);
      });
    };

    const handleTacticalIntelUpdate = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;

      const severity = data.severity ? (data.severity.toLowerCase() as "low" | "medium" | "high" | "critical") : undefined;

      setUnacknowledgedAlerts(prev => prev.map(a => {
        if (a.id === alertId || a.alert_id === alertId) {
          return {
            ...a,
            severity: severity || a.severity,
            message: data.transcript ? `[Voice Analysis] "${data.transcript}"` : a.message,
            trigger_type: data.trigger_type || a.trigger_type,
          };
        }
        return a;
      }));

      setPopups(prev => prev.map(p => {
        if (p.id === alertId || p.alert.id === alertId || p.alert.alert_id === alertId) {
          return {
            ...p,
            alert: {
              ...p.alert,
              severity: severity || p.alert.severity,
              message: data.transcript ? `[Voice Analysis] "${data.transcript}"` : p.alert.message,
              trigger_type: data.trigger_type || p.alert.trigger_type,
            }
          };
        }
        return p;
      }));
    };

    socket.on("new_sos_alert", handleNewSOSAlert);
    socket.on("tactical_intel_update", handleTacticalIntelUpdate);
    socket.on("sos_alert_acknowledged", handleAlertAcknowledged);
    socket.on("sos_alert_resolved", handleAlertResolved);

    return () => {
      socket.off("new_sos_alert", handleNewSOSAlert);
      socket.off("tactical_intel_update", handleTacticalIntelUpdate);
      socket.off("sos_alert_acknowledged", handleAlertAcknowledged);
      socket.off("sos_alert_resolved", handleAlertResolved);
    };
  }, [socket, playAlertSound]);

  const dismissPopup = useCallback((alertId: string) => {
    setPopups(prev => prev.filter(p => p.id !== alertId));
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      // Optimistically update counts and dismiss popup
      setPopups(prev => prev.filter(p => p.id !== alertId));
      setUnacknowledgedAlerts(prev => {
        const target = prev.find(a => a.id === alertId);
        if (target) {
          setUnacknowledgedCount(c => Math.max(0, c - 1));
          if (target.severity === "critical") {
            setCriticalCount(cc => Math.max(0, cc - 1));
          }
        }
        return prev.filter(a => a.id !== alertId);
      });

      await adminAPI.acknowledgeAlert(alertId);
    } catch (err) {
      console.error(`Failed to acknowledge alert ${alertId}:`, err);
      // Re-fetch exact counts if error occurs
      refreshCounts();
    }
  }, [refreshCounts]);

  const viewSOS = useCallback((alertId: string) => {
    // Acknowledge in background and navigate to alerts page with alertId selected
    acknowledgeAlert(alertId);
    dismissPopup(alertId);
    navigate(`/alerts?alertId=${encodeURIComponent(alertId)}`);
  }, [acknowledgeAlert, dismissPopup, navigate]);

  return (
    <SOSAlertContext.Provider
      value={{
        unacknowledgedCount,
        criticalCount,
        unacknowledgedAlerts,
        popups,
        acknowledgeAlert,
        dismissPopup,
        viewSOS,
        refreshCounts,
      }}
    >
      {children}
    </SOSAlertContext.Provider>
  );
};

export const useSOSAlerts = () => {
  const ctx = useContext(SOSAlertContext);
  if (!ctx) {
    throw new Error("useSOSAlerts must be used within SOSAlertProvider");
  }
  return ctx;
};
