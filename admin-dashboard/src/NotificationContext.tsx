import React, { createContext, useContext, useState, useEffect } from "react";
import { useSocket } from "./SocketContext";

export interface Notification {
  id: string;
  type: "sos_alert" | "complaint" | "critical_risk" | "emergency_update";
  title: string;
  message: string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
  read: boolean;
  link?: string;
  toastFired?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { socket } = useSocket();

  useEffect(() => {
    const saved = localStorage.getItem("safeher_notifications");
    if (saved) {
      try {
        setNotifications(JSON.parse(saved).map((n: Notification) => ({ ...n, toastFired: true })));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("safeher_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (!socket) return;

    const playAlertSound = () => {
      try {
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
        audio.play().catch(() => {});
      } catch (e) {}
    };

    const addNotification = (notif: Notification) => {
      setNotifications(prev => {
        if (prev.find(n => n.id === notif.id)) return prev;
        
        if (notif.severity === "high" || notif.severity === "critical") {
            playAlertSound();
        }
        
        return [{...notif, toastFired: false}, ...prev];
      });
    };

    socket.on("new_sos_alert", (data) => {
      const alertId = data.alert_id || data.id || data.user_id;
      addNotification({
        id: alertId,
        type: "sos_alert",
        title: "🚨 ACTIVE SOS ALERT",
        message: `SOS Triggered by ${data.user_name || "User " + data.user_id}`,
        timestamp: data.timestamp || new Date().toISOString(),
        severity: data.severity || "critical",
        read: false,
        link: `/alerts?alertId=${alertId}`,
        toastFired: true, // SOSInstantPopups handles the rich interactive popup
      });
    });

    socket.on("new_complaint", (data) => {
        addNotification({
            id: data.complaint_id || "comp_" + Date.now().toString(),
            type: "complaint",
            title: "📄 New Complaint",
            message: data.title ? `${data.title} — ${data.district || ""}` : "A new complaint was submitted",
            timestamp: new Date().toISOString(),
            severity: "medium",
            read: false,
            link: "/complaints"
        });
    });

    socket.on("critical_risk", (data) => {
        addNotification({
            id: data.risk_id || "risk_" + Date.now().toString(),
            type: "critical_risk",
            title: "⚠️ CRITICAL AI RISK",
            message: data.message || "High risk predicted in monitored sector",
            timestamp: new Date().toISOString(),
            severity: "high",
            read: false,
            link: "/ai-intelligence"
        });
    });

    return () => {
      socket.off("new_sos_alert");
      socket.off("new_complaint");
      socket.off("critical_risk");
    };
  }, [socket]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => setNotifications([]);

  const dismissToast = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, toastFired: true } : n));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, dismissToast }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
};
