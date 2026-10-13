import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "./NotificationContext";
import type { Notification } from "./NotificationContext";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  AlertTriangle,
  Info,
  CheckCircle,
  ShieldAlert,
  Sparkles,
  Inbox,
  Clock,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getSeverityTheme = (severity: string) => {
  switch (severity) {
    case "critical":
      return {
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.5)",
        glow: "rgba(239, 68, 68, 0.25)",
        tagBg: "linear-gradient(135deg, #ef4444, #dc2626)",
        text: "#f87171",
        icon: <ShieldAlert className="text-red-400" size={18} />,
        accent: "#ef4444",
      };
    case "high":
      return {
        bg: "rgba(249, 115, 22, 0.12)",
        border: "rgba(249, 115, 22, 0.45)",
        glow: "rgba(249, 115, 22, 0.2)",
        tagBg: "linear-gradient(135deg, #f97316, #ea580c)",
        text: "#fb923c",
        icon: <AlertTriangle className="text-orange-400" size={18} />,
        accent: "#f97316",
      };
    case "medium":
      return {
        bg: "rgba(234, 179, 8, 0.1)",
        border: "rgba(234, 179, 8, 0.35)",
        glow: "rgba(234, 179, 8, 0.15)",
        tagBg: "linear-gradient(135deg, #eab308, #ca8a04)",
        text: "#facc15",
        icon: <Info className="text-yellow-400" size={18} />,
        accent: "#eab308",
      };
    default:
      return {
        bg: "rgba(99, 102, 241, 0.1)",
        border: "rgba(99, 102, 241, 0.3)",
        glow: "rgba(99, 102, 241, 0.15)",
        tagBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
        text: "#818cf8",
        icon: <CheckCircle className="text-indigo-400" size={18} />,
        accent: "#6366f1",
      };
  }
};

export const NotificationToasts: React.FC = () => {
  const { notifications, dismissToast, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const activeToasts = notifications.filter((n) => !n.toastFired).slice(0, 3);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        pointerEvents: "none",
        maxWidth: "380px",
        width: "calc(100vw - 48px)",
      }}
    >
      <AnimatePresence>
        {activeToasts.map((toast) => {
          const s = getSeverityTheme(toast.severity);
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{
                pointerEvents: "auto",
                background:
                  "linear-gradient(135deg, rgba(20, 15, 45, 0.95) 0%, rgba(10, 8, 26, 0.98) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: `1px solid ${s.border}`,
                boxShadow: `0 14px 35px -8px rgba(0, 0, 0, 0.75), 0 0 20px ${s.glow}`,
                borderRadius: "14px",
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                cursor: "pointer",
                position: "relative",
                overflow: "hidden",
              }}
              onClick={() => {
                dismissToast(toast.id);
                markAsRead(toast.id);
                if (toast.link) navigate(toast.link);
              }}
            >
              {/* Left severity indicator bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  background: s.accent,
                }}
              />

              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  background: s.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: "2px",
                  border: `1px solid ${s.border}`,
                }}
              >
                {s.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <h4
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "0.2px",
                    }}
                  >
                    {toast.title}
                  </h4>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      background: s.tagBg,
                      color: "#fff",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {toast.severity}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#cbd5e1",
                    marginTop: "4px",
                    lineHeight: "1.35",
                  }}
                >
                  {toast.message}
                </p>
                <p
                  style={{
                    fontSize: "10px",
                    color: "#94a3b8",
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Clock size={11} />
                  {new Date(toast.timestamp).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "8px",
                  color: "#94a3b8",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: "20px",
        right: "24px",
        zIndex: 10000,
      }}
    >
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          width: "44px",
          height: "44px",
          borderRadius: "13px",
          background: isOpen
            ? "linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%)"
            : "linear-gradient(135deg, rgba(24, 18, 55, 0.85) 0%, rgba(14, 10, 34, 0.95) 100%)",
          border: isOpen
            ? "1.5px solid rgba(139, 92, 246, 0.7)"
            : "1px solid rgba(139, 92, 246, 0.3)",
          color: isOpen ? "#ffffff" : "#c4b5fd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: isOpen
            ? "0 0 25px rgba(139, 92, 246, 0.45), 0 8px 20px rgba(0, 0, 0, 0.5)"
            : "0 4px 18px rgba(0, 0, 0, 0.4), 0 0 12px rgba(139, 92, 246, 0.15)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.6)";
          e.currentTarget.style.boxShadow =
            "0 6px 22px rgba(0, 0, 0, 0.5), 0 0 18px rgba(139, 92, 246, 0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.borderColor = isOpen
            ? "rgba(139, 92, 246, 0.7)"
            : "rgba(139, 92, 246, 0.3)";
          e.currentTarget.style.boxShadow = isOpen
            ? "0 0 25px rgba(139, 92, 246, 0.45), 0 8px 20px rgba(0, 0, 0, 0.5)"
            : "0 4px 18px rgba(0, 0, 0, 0.4), 0 0 12px rgba(139, 92, 246, 0.15)";
        }}
        title="Command Notifications"
        aria-label="Command Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "19px",
              height: "19px",
              padding: "0 5px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(239, 68, 68, 0.85)",
              border: "1.5px solid #060412",
              letterSpacing: "0.2px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "54px",
              right: "0",
              width: "410px",
              maxWidth: "calc(100vw - 36px)",
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              background:
                "linear-gradient(145deg, rgba(18, 12, 42, 0.98) 0%, rgba(8, 6, 20, 0.99) 100%)",
              backdropFilter: "blur(30px)",
              WebkitBackdropFilter: "blur(30px)",
              border: "1px solid rgba(139, 92, 246, 0.35)",
              borderRadius: "18px",
              boxShadow:
                "0 24px 60px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(139, 92, 246, 0.22)",
              overflow: "hidden",
            }}
          >
            {/* Top aesthetic gradient bar */}
            <div
              style={{
                height: "3px",
                width: "100%",
                background:
                  "linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #ec4899 100%)",
              }}
            />

            {/* Header */}
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    background: "rgba(139, 92, 246, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(139, 92, 246, 0.35)",
                  }}
                >
                  <Bell size={15} color="#c4b5fd" />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: "#ffffff",
                      letterSpacing: "-0.2px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    Incident Dispatches
                    {unreadCount > 0 && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "10px",
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.4)",
                        }}
                      >
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                    SafeHer Command Stream
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#a78bfa",
                      background: "rgba(139, 92, 246, 0.12)",
                      border: "1px solid rgba(139, 92, 246, 0.25)",
                      padding: "4px 9px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.background =
                        "rgba(139, 92, 246, 0.25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#a78bfa";
                      e.currentTarget.style.background =
                        "rgba(139, 92, 246, 0.12)";
                    }}
                  >
                    Mark read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#94a3b8",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px 6px",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* List Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            >
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: "36px 20px",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "16px",
                      background: "rgba(139, 92, 246, 0.1)",
                      border: "1px solid rgba(139, 92, 246, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 20px rgba(139, 92, 246, 0.15)",
                    }}
                  >
                    <Sparkles size={22} color="#8b5cf6" />
                  </div>
                  <h4
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#e2e8f0",
                    }}
                  >
                    All Monitored Sectors Clear
                  </h4>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "#64748b",
                      maxWidth: "260px",
                      lineHeight: "1.4",
                    }}
                  >
                    Real-time incident updates, critical alerts, and emergency dispatches will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const s = getSeverityTheme(n.severity);
                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        markAsRead(n.id);
                        if (n.link) {
                          setIsOpen(false);
                          navigate(n.link);
                        }
                      }}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: n.read
                          ? "rgba(255, 255, 255, 0.02)"
                          : "linear-gradient(135deg, rgba(28, 20, 60, 0.7) 0%, rgba(16, 12, 38, 0.85) 100%)",
                        border: n.read
                          ? "1px solid rgba(255, 255, 255, 0.04)"
                          : `1px solid ${s.border}`,
                        boxShadow: n.read
                          ? "none"
                          : `0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px ${s.glow}`,
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex",
                        gap: "12px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = s.accent;
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = n.read
                          ? "rgba(255, 255, 255, 0.04)"
                          : s.border;
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {/* Left color bar */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: "3px",
                          background: s.accent,
                        }}
                      />

                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          background: s.bg,
                          border: `1px solid ${s.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        {s.icon}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "6px",
                          }}
                        >
                          <h4
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: n.read ? "#cbd5e1" : "#ffffff",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {n.title}
                          </h4>
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 800,
                              padding: "1px 5px",
                              borderRadius: "4px",
                              background: s.tagBg,
                              color: "#fff",
                              textTransform: "uppercase",
                              flexShrink: 0,
                            }}
                          >
                            {n.severity}
                          </span>
                        </div>

                        <p
                          style={{
                            fontSize: "11px",
                            color: n.read ? "#64748b" : "#94a3b8",
                            marginTop: "3px",
                            lineHeight: "1.35",
                          }}
                        >
                          {n.message}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginTop: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748b",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Clock size={10} />
                            {new Date(n.timestamp).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {!n.read && (
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#8b5cf6",
                                boxShadow: "0 0 8px #8b5cf6",
                                display: "inline-block",
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
