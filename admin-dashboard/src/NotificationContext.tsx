import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { adminAPI } from "./api";

export interface Notification {
  id: string;
  type: "sos_alert" | "complaint" | "critical_risk" | "emergency_update" | "tactical_intel" | "broadcast";
  title: string;
  message: string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  read: boolean;
  link?: string;
  toastFired?: boolean;
  metadata?: {
    userName?: string;
    userPhone?: string;
    triggerType?: string;
    location?: any;
    status?: string;
    alertId?: string;
    district?: string;
    category?: string;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  sosAlertsCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
  deleteNotification: (id: string) => void;
  acknowledgeAlertNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { socket } = useSocket();

  // Load persisted notifications on mount
  useEffect(() => {
    const saved = localStorage.getItem("safeher_notifications");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setNotifications(parsed.map((n: Notification) => ({ ...n, toastFired: true })));
        }
      } catch (e) {
        console.warn("Failed to parse saved notifications", e);
      }
    }
  }, []);

  // Persist notifications on change (cap at 100 recent)
  useEffect(() => {
    try {
      localStorage.setItem("safeher_notifications", JSON.stringify(notifications.slice(0, 100)));
    } catch (e) {}
  }, [notifications]);

  const playAlertSound = useCallback((severity: string) => {
    try {
      const audioUrl = severity === "critical"
        ? "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
        : "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
      const audio = new Audio(audioUrl);
      audio.volume = severity === "critical" ? 0.8 : 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  // Fetch active / unacknowledged alerts & complaints from backend
  const refreshNotifications = useCallback(async () => {
    try {
      // 1. Fetch unacknowledged SOS alerts
      const res = await adminAPI.getUnacknowledgedAlerts(25);
      if (res?.data && Array.isArray(res.data)) {
        const remoteAlerts: Notification[] = res.data.map((alert: any) => {
          const alertId = alert.id || alert.alert_id || alert._id;
          const userTitle = alert.user_name || (alert.user_id ? `User ${alert.user_id.slice(-6)}` : "Emergency User");
          const trigger = alert.trigger_type ? alert.trigger_type.toUpperCase() : "SOS";
          return {
            id: alertId,
            type: "sos_alert" as const,
            title: `🚨 ACTIVE SOS: ${userTitle}`,
            message: alert.message || `Emergency triggered via ${trigger} mode`,
            timestamp: alert.created_at || alert.timestamp || new Date().toISOString(),
            severity: (alert.severity || "critical").toLowerCase() as "critical" | "high" | "medium" | "low",
            read: alert.acknowledged || false,
            link: `/alerts?alertId=${alertId}`,
            toastFired: true,
            metadata: {
              userName: alert.user_name,
              userPhone: alert.user_phone,
              triggerType: alert.trigger_type,
              location: alert.location,
              status: alert.status || "active",
              alertId: alertId,
            },
          };
        });

        setNotifications((prev) => {
          // Merge by alert ID so we don't duplicate existing ones
          const map = new Map<string, Notification>();
          // Put new fetched remote alerts first
          remoteAlerts.forEach((a) => map.set(a.id, a));
          // Overlay existing state (preserving any user-marked read flags if newer)
          prev.forEach((existing) => {
            if (map.has(existing.id)) {
              const remote = map.get(existing.id)!;
              map.set(existing.id, {
                ...remote,
                read: existing.read || remote.read,
                toastFired: true,
              });
            } else {
              map.set(existing.id, existing);
            }
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });
      }
    } catch (err) {
      // Background sync may fail if unauthorized; silently ignore
    }
  }, []);

  // Initial sync & periodic background sync
  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 30000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    const addNotification = (notif: Notification) => {
      setNotifications((prev) => {
        // If already exists, update it in place
        const existingIndex = prev.findIndex((n) => n.id === notif.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...notif,
            read: false,
            toastFired: false,
          };
          return updated;
        }

        if (notif.severity === "high" || notif.severity === "critical") {
          playAlertSound(notif.severity);
        }

        return [{ ...notif, toastFired: false }, ...prev];
      });
    };

    const handleNewSOSAlert = (data: any) => {
      const alertId = data.alert_id || data.id || data.user_id;
      const userTitle = data.user_name || (data.user_id ? `User ${String(data.user_id).slice(-6)}` : "Emergency User");
      const trigger = data.trigger_type ? data.trigger_type.toUpperCase() : "SOS";

      addNotification({
        id: alertId,
        type: "sos_alert",
        title: `🚨 ACTIVE SOS: ${userTitle}`,
        message: data.message || `Emergency triggered via ${trigger} mode`,
        timestamp: data.timestamp || data.created_at || new Date().toISOString(),
        severity: (data.severity || "critical").toLowerCase() as any,
        read: false,
        link: `/alerts?alertId=${alertId}`,
        toastFired: true, // SOSInstantPopups handles the heavy modal
        metadata: {
          userName: data.user_name,
          userPhone: data.user_phone,
          triggerType: data.trigger_type,
          location: data.location,
          status: "active",
          alertId: alertId,
        },
      });
    };

    const handleTacticalIntelUpdate = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;

      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === alertId || n.metadata?.alertId === alertId) {
            const summary = data.transcript
              ? `[AI Audio Intel] "${data.transcript}"`
              : (data.tactical_intel?.summary || n.message);
            return {
              ...n,
              message: summary,
              severity: data.severity ? (data.severity.toLowerCase() as any) : n.severity,
              metadata: {
                ...n.metadata,
                triggerType: data.trigger_type || n.metadata?.triggerType,
              },
            };
          }
          return n;
        })
      );
    };

    const handleAlertAcknowledged = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === alertId || n.metadata?.alertId === alertId
            ? {
                ...n,
                read: true,
                title: n.title.replace("🚨 ACTIVE SOS:", "🛡️ [IN PROGRESS]:"),
                metadata: { ...n.metadata, status: "acknowledged" },
              }
            : n
        )
      );
    };

    const handleAlertResolved = (data: any) => {
      const alertId = data.alert_id || data.id;
      if (!alertId) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === alertId || n.metadata?.alertId === alertId
            ? {
                ...n,
                read: true,
                severity: "low",
                title: n.title.replace("🚨 ACTIVE SOS:", "✅ RESOLVED:").replace("🛡️ [IN PROGRESS]:", "✅ RESOLVED:"),
                metadata: { ...n.metadata, status: "resolved" },
              }
            : n
        )
      );
    };

    const handleNewComplaint = (data: any) => {
      const compId = data.complaint_id || data.id || "comp_" + Date.now().toString();
      addNotification({
        id: compId,
        type: "complaint",
        title: `📄 New Citizen Complaint: ${data.category || "Safety Report"}`,
        message: data.title ? `${data.title} — ${data.district || "Sector"}` : "A new incident report was registered.",
        timestamp: data.created_at || new Date().toISOString(),
        severity: "medium",
        read: false,
        link: "/complaints",
        metadata: {
          district: data.district,
          category: data.category,
        },
      });
    };

    const handleCriticalRisk = (data: any) => {
      const riskId = data.risk_id || "risk_" + Date.now().toString();
      addNotification({
        id: riskId,
        type: "critical_risk",
        title: "⚠️ CRITICAL SECTOR RISK PREDICTED",
        message: data.message || `Elevated threat index detected in sector ${data.sector || "alpha"}.`,
        timestamp: new Date().toISOString(),
        severity: "high",
        read: false,
        link: "/ai-intelligence",
      });
    };

    const handleBroadcast = (data: any) => {
      addNotification({
        id: "bcast_" + Date.now().toString(),
        type: "broadcast",
        title: `📢 State Broadcast: ${data.title || "Safety Advisory"}`,
        message: data.message || "A new official command advisory has been dispatched.",
        timestamp: new Date().toISOString(),
        severity: "low",
        read: false,
        link: "/broadcast",
      });
    };

    socket.on("new_sos_alert", handleNewSOSAlert);
    socket.on("tactical_intel_update", handleTacticalIntelUpdate);
    socket.on("sos_alert_acknowledged", handleAlertAcknowledged);
    socket.on("sos_alert_resolved", handleAlertResolved);
    socket.on("new_complaint", handleNewComplaint);
    socket.on("critical_risk", handleCriticalRisk);
    socket.on("new_broadcast", handleBroadcast);

    return () => {
      socket.off("new_sos_alert", handleNewSOSAlert);
      socket.off("tactical_intel_update", handleTacticalIntelUpdate);
      socket.off("sos_alert_acknowledged", handleAlertAcknowledged);
      socket.off("sos_alert_resolved", handleAlertResolved);
      socket.off("new_complaint", handleNewComplaint);
      socket.off("critical_risk", handleCriticalRisk);
      socket.off("new_broadcast", handleBroadcast);
    };
  }, [socket, playAlertSound]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const sosAlertsCount = notifications.filter(
    (n) => n.type === "sos_alert" && n.metadata?.status !== "resolved" && !n.read
  ).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => setNotifications([]);

  const dismissToast = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, toastFired: true } : n)));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const acknowledgeAlertNotification = async (id: string) => {
    try {
      await adminAPI.acknowledgeAlert(id);
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id === id || n.metadata?.alertId === id) {
            return {
              ...n,
              read: true,
              title: n.title.replace("🚨 ACTIVE SOS:", "🛡️ [IN PROGRESS]:"),
              metadata: { ...n.metadata, status: "acknowledged" },
            };
          }
          return n;
        })
      );
    } catch (e) {
      console.error("Failed to acknowledge alert from notification center:", e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        sosAlertsCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        dismissToast,
        deleteNotification,
        acknowledgeAlertNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
};
