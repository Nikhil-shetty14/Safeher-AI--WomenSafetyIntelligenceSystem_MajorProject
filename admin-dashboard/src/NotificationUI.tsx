import React, { useState, useRef, useEffect, useMemo } from "react";
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
  GripVertical,
  RotateCcw,
  FileText,
  Phone,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getSeverityTheme = (severity: string) => {
  switch (severity) {
    case "critical":
      return {
        bg: "rgba(239, 68, 68, 0.14)",
        border: "rgba(239, 68, 68, 0.55)",
        glow: "rgba(239, 68, 68, 0.35)",
        tagBg: "linear-gradient(135deg, #ef4444, #dc2626)",
        text: "#f87171",
        icon: <ShieldAlert className="text-red-400" size={18} />,
        accent: "#ef4444",
      };
    case "high":
      return {
        bg: "rgba(249, 115, 22, 0.14)",
        border: "rgba(249, 115, 22, 0.5)",
        glow: "rgba(249, 115, 22, 0.25)",
        tagBg: "linear-gradient(135deg, #f97316, #ea580c)",
        text: "#fb923c",
        icon: <AlertTriangle className="text-orange-400" size={18} />,
        accent: "#f97316",
      };
    case "medium":
      return {
        bg: "rgba(234, 179, 8, 0.12)",
        border: "rgba(234, 179, 8, 0.4)",
        glow: "rgba(234, 179, 8, 0.2)",
        tagBg: "linear-gradient(135deg, #eab308, #ca8a04)",
        text: "#facc15",
        icon: <Info className="text-yellow-400" size={18} />,
        accent: "#eab308",
      };
    default:
      return {
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.35)",
        glow: "rgba(99, 102, 241, 0.2)",
        tagBg: "linear-gradient(135deg, #6366f1, #4f46e5)",
        text: "#818cf8",
        icon: <CheckCircle className="text-indigo-400" size={18} />,
        accent: "#6366f1",
      };
  }
};

const formatRelativeTime = (timestamp: string) => {
  try {
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 15) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch (e) {
    return timestamp;
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
  const {
    notifications,
    unreadCount,
    sosAlertsCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteNotification,
    acknowledgeAlertNotification,
    refreshNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "sos" | "complaints" | "intel">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Draggable positioning state
  const getInitialPos = () => {
    try {
      const saved = localStorage.getItem("safeher_admin_bell_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return {
            x: Math.min(Math.max(16, parsed.x), window.innerWidth - 80),
            y: Math.min(Math.max(16, parsed.y), window.innerHeight - 80),
          };
        }
      }
    } catch (e) {}
    // Default safe placement: top-right, comfortably BELOW the header bar (so it never overlaps REFRESH button)
    return {
      x: Math.max(16, window.innerWidth - 84),
      y: 78,
    };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>(getInitialPos);
  const [isDragging, setIsDragging] = useState(false);

  // Drag tracking refs
  const dragRef = useRef<{
    isPointerDown: boolean;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    hasMoved: boolean;
  }>({
    isPointerDown: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
  });

  // Clamp within viewport on resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => ({
        x: Math.min(Math.max(16, prev.x), window.innerWidth - 80),
        y: Math.min(Math.max(16, prev.y), window.innerHeight - 80),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary mouse button or touch
    dragRef.current = {
      isPointerDown: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
      hasMoved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isPointerDown) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (!dragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragRef.current.hasMoved = true;
      setIsDragging(true);
    }

    if (dragRef.current.hasMoved) {
      const newX = Math.min(Math.max(16, dragRef.current.initialX + dx), window.innerWidth - 80);
      const newY = Math.min(Math.max(16, dragRef.current.initialY + dy), window.innerHeight - 80);
      setPos({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.isPointerDown) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    const wasMoved = dragRef.current.hasMoved;
    dragRef.current.isPointerDown = false;
    setIsDragging(false);

    if (wasMoved) {
      localStorage.setItem("safeher_admin_bell_pos", JSON.stringify(pos));
    } else {
      // Clean click: toggle dropdown
      setIsOpen((prev) => !prev);
    }
  };

  // Reset bell position to default
  const resetPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultPos = {
      x: Math.max(16, window.innerWidth - 84),
      y: 78,
    };
    setPos(defaultPos);
    localStorage.setItem("safeher_admin_bell_pos", JSON.stringify(defaultPos));
  };

  // Adaptive dropdown placement
  const isNearRight = pos.x > 420;
  const isNearBottom = pos.y > window.innerHeight - 480;

  // Notification category counts
  const sosList = useMemo(() => notifications.filter((n) => n.type === "sos_alert"), [notifications]);
  const complaintsList = useMemo(() => notifications.filter((n) => n.type === "complaint"), [notifications]);
  const intelList = useMemo(
    () => notifications.filter((n) => n.type === "critical_risk" || n.type === "tactical_intel" || n.type === "broadcast"),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === "sos") return sosList;
    if (activeTab === "complaints") return complaintsList;
    if (activeTab === "intel") return intelList;
    return notifications;
  }, [activeTab, notifications, sosList, complaintsList, intelList]);

  const activeSosUnread = sosList.filter((n) => !n.read && n.metadata?.status !== "resolved").length;
  const complaintsUnread = complaintsList.filter((n) => !n.read).length;
  const intelUnread = intelList.filter((n) => !n.read).length;

  return (
    <>
      {/* Keyframe injection for pulsing active emergency */}
      <style>
        {`
          @keyframes safeherBellBeacon {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.75), 0 4px 18px rgba(0, 0, 0, 0.5); }
            50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0), 0 0 25px rgba(239, 68, 68, 0.65); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 4px 18px rgba(0, 0, 0, 0.5); }
          }
          @keyframes safeherSubtleGlow {
            0% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.35); }
            50% { box-shadow: 0 0 25px rgba(139, 92, 246, 0.65); }
            100% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.35); }
          }
        `}
      </style>

      <div
        ref={dropdownRef}
        style={{
          position: "fixed",
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          zIndex: 10000,
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {/* Floating Bell Trigger Button with Drag Grip */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          title="Drag anywhere to reposition • Click to open Command Alerts"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "0 10px 0 6px",
            height: "46px",
            borderRadius: "14px",
            background: isOpen
              ? "linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(99, 102, 241, 0.28) 100%)"
              : activeSosUnread > 0
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(20, 15, 45, 0.95) 100%)"
              : "linear-gradient(135deg, rgba(24, 18, 55, 0.9) 0%, rgba(12, 9, 30, 0.95) 100%)",
            border: isOpen
              ? "1.5px solid rgba(139, 92, 246, 0.8)"
              : activeSosUnread > 0
              ? "1.5px solid rgba(239, 68, 68, 0.7)"
              : "1px solid rgba(139, 92, 246, 0.35)",
            color: isOpen ? "#ffffff" : activeSosUnread > 0 ? "#fca5a5" : "#c4b5fd",
            cursor: isDragging ? "grabbing" : "grab",
            transition: isDragging ? "none" : "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: isDragging ? "scale(1.08)" : "scale(1)",
            boxShadow: isDragging
              ? "0 12px 30px rgba(0, 0, 0, 0.7), 0 0 25px rgba(139, 92, 246, 0.6)"
              : activeSosUnread > 0
              ? undefined // animated via keyframe
              : isOpen
              ? "0 0 25px rgba(139, 92, 246, 0.45), 0 8px 20px rgba(0, 0, 0, 0.5)"
              : "0 4px 18px rgba(0, 0, 0, 0.45), 0 0 12px rgba(139, 92, 246, 0.15)",
            animation: activeSosUnread > 0 ? "safeherBellBeacon 2s infinite" : undefined,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Draggable Grip Handle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isDragging ? "#a78bfa" : "rgba(167, 139, 250, 0.5)",
              padding: "2px",
            }}
          >
            <GripVertical size={14} />
          </div>

          {/* Bell Icon */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Bell
              size={20}
              style={{
                filter: activeSosUnread > 0 ? "drop-shadow(0 0 6px #ef4444)" : undefined,
                animation: activeSosUnread > 0 ? "spin 3s ease-in-out infinite" : undefined,
              }}
            />

            {/* Badge Indicator */}
            {unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-12px",
                  minWidth: "19px",
                  height: "19px",
                  padding: "0 5px",
                  borderRadius: "10px",
                  background:
                    activeSosUnread > 0
                      ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                      : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    activeSosUnread > 0
                      ? "0 0 10px rgba(239, 68, 68, 0.9)"
                      : "0 0 8px rgba(139, 92, 246, 0.7)",
                  border: "1.5px solid #060412",
                  letterSpacing: "0.2px",
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Menu (Adaptive Alignment) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: isNearBottom ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: isNearBottom ? 10 : -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "absolute",
                ...(isNearRight ? { right: 0 } : { left: 0 }),
                ...(isNearBottom ? { bottom: "56px" } : { top: "56px" }),
                width: "440px",
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "82vh",
                display: "flex",
                flexDirection: "column",
                background:
                  "linear-gradient(145deg, rgba(16, 11, 38, 0.98) 0%, rgba(8, 6, 20, 0.99) 100%)",
                backdropFilter: "blur(32px)",
                WebkitBackdropFilter: "blur(32px)",
                border: "1px solid rgba(139, 92, 246, 0.35)",
                borderRadius: "18px",
                boxShadow:
                  "0 24px 60px -10px rgba(0, 0, 0, 0.9), 0 0 35px rgba(139, 92, 246, 0.25)",
                overflow: "hidden",
              }}
            >
              {/* Aesthetic gradient bar */}
              <div
                style={{
                  height: "3px",
                  width: "100%",
                  background:
                    activeSosUnread > 0
                      ? "linear-gradient(90deg, #ef4444 0%, #f97316 50%, #8b5cf6 100%)"
                      : "linear-gradient(90deg, #8b5cf6 0%, #6366f1 50%, #ec4899 100%)",
                }}
              />

              {/* Header */}
              <div
                style={{
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "rgba(255, 255, 255, 0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "10px",
                      background:
                        activeSosUnread > 0
                          ? "rgba(239, 68, 68, 0.2)"
                          : "rgba(139, 92, 246, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border:
                        activeSosUnread > 0
                          ? "1px solid rgba(239, 68, 68, 0.45)"
                          : "1px solid rgba(139, 92, 246, 0.35)",
                    }}
                  >
                    <Bell
                      size={16}
                      color={activeSosUnread > 0 ? "#f87171" : "#c4b5fd"}
                    />
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
                      SafeHer Command Alerts
                      {unreadCount > 0 && (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "1px 7px",
                            borderRadius: "10px",
                            background:
                              activeSosUnread > 0
                                ? "rgba(239, 68, 68, 0.25)"
                                : "rgba(139, 92, 246, 0.2)",
                            color: activeSosUnread > 0 ? "#fca5a5" : "#c4b5fd",
                            border:
                              activeSosUnread > 0
                                ? "1px solid rgba(239, 68, 68, 0.45)"
                                : "1px solid rgba(139, 92, 246, 0.3)",
                          }}
                        >
                          {unreadCount} unread
                        </span>
                      )}
                    </h3>
                    <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px" }}>
                      Draggable Floating Hub • Real-time Stream
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    onClick={resetPosition}
                    title="Reset notification bell position to default"
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "7px",
                      color: "#94a3b8",
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#c4b5fd";
                      e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#94a3b8";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    }}
                  >
                    <RotateCcw size={12} />
                  </button>

                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#a78bfa",
                        background: "rgba(139, 92, 246, 0.12)",
                        border: "1px solid rgba(139, 92, 246, 0.25)",
                        padding: "4px 8px",
                        borderRadius: "7px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#a78bfa";
                        e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
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

              {/* Tabs Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: "rgba(0, 0, 0, 0.25)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  overflowX: "auto",
                }}
              >
                {[
                  { id: "all", label: "All", count: notifications.length },
                  { id: "sos", label: "🚨 SOS Alerts", count: sosList.length, highlight: activeSosUnread > 0 },
                  { id: "complaints", label: "📄 Complaints", count: complaintsList.length },
                  { id: "intel", label: "⚠️ Intel & Risks", count: intelList.length },
                ].map((t) => {
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        cursor: "pointer",
                        border: active
                          ? t.highlight
                            ? "1px solid rgba(239, 68, 68, 0.6)"
                            : "1px solid rgba(139, 92, 246, 0.6)"
                          : "1px solid transparent",
                        background: active
                          ? t.highlight
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(139, 92, 246, 0.2)"
                          : "rgba(255, 255, 255, 0.03)",
                        color: active ? "#ffffff" : "#94a3b8",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{t.label}</span>
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "1px 5px",
                          borderRadius: "10px",
                          background: active ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.06)",
                          color: active ? "#ffffff" : "#64748b",
                        }}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Notification Items List */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: "rgba(0, 0, 0, 0.2)",
                  maxHeight: "58vh",
                }}
              >
                {filteredNotifications.length === 0 ? (
                  <div
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
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
                    <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>
                      {activeTab === "sos"
                        ? "No Active SOS Emergencies"
                        : activeTab === "complaints"
                        ? "No Pending Citizen Complaints"
                        : activeTab === "intel"
                        ? "All Sector Threat Sensors Nominal"
                        : "All Monitored Sectors Clear"}
                    </h4>
                    <p style={{ fontSize: "11px", color: "#64748b", maxWidth: "260px", lineHeight: "1.4" }}>
                      Real-time incident updates, tactical telemetry, and emergency dispatches will populate here automatically.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((n) => {
                    const s = getSeverityTheme(n.severity);
                    const isSOS = n.type === "sos_alert";
                    const isResolved = n.metadata?.status === "resolved";
                    const isAcked = n.metadata?.status === "acknowledged";

                    return (
                      <div
                        key={n.id}
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          background: n.read
                            ? "rgba(255, 255, 255, 0.02)"
                            : isSOS && !isResolved
                            ? "linear-gradient(135deg, rgba(38, 16, 26, 0.85) 0%, rgba(18, 10, 24, 0.95) 100%)"
                            : "linear-gradient(135deg, rgba(28, 20, 60, 0.75) 0%, rgba(14, 10, 34, 0.9) 100%)",
                          border: n.read
                            ? "1px solid rgba(255, 255, 255, 0.05)"
                            : isSOS && !isResolved
                            ? "1px solid rgba(239, 68, 68, 0.55)"
                            : `1px solid ${s.border}`,
                          boxShadow: n.read
                            ? "none"
                            : isSOS && !isResolved
                            ? "0 4px 18px rgba(0, 0, 0, 0.5), 0 0 16px rgba(239, 68, 68, 0.25)"
                            : `0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px ${s.glow}`,
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          position: "relative",
                          overflow: "hidden",
                          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
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
                            background: isSOS && !isResolved ? "#ef4444" : s.accent,
                          }}
                        />

                        {/* Top row: Icon, Title, Severity & Dismiss */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "9px",
                              background: s.bg,
                              border: `1px solid ${s.border}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: "1px",
                            }}
                          >
                            {isSOS ? (
                              <ShieldAlert
                                size={17}
                                color={isResolved ? "#10b981" : "#ef4444"}
                              />
                            ) : n.type === "complaint" ? (
                              <FileText size={17} color="#fb923c" />
                            ) : (
                              s.icon
                            )}
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
                                  fontSize: "12.5px",
                                  fontWeight: 800,
                                  color: n.read ? "#cbd5e1" : "#ffffff",
                                  letterSpacing: "-0.1px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {n.title}
                              </h4>

                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 800,
                                    padding: "2px 6px",
                                    borderRadius: "5px",
                                    background: isResolved ? "rgba(16, 185, 129, 0.2)" : s.tagBg,
                                    color: isResolved ? "#34d399" : "#fff",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.3px",
                                  }}
                                >
                                  {isResolved ? "RESOLVED" : n.severity}
                                </span>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(n.id);
                                  }}
                                  title="Dismiss notification"
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#64748b",
                                    cursor: "pointer",
                                    padding: "2px",
                                    display: "flex",
                                    alignItems: "center",
                                    transition: "color 0.15s",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Message / Details */}
                            <p
                              style={{
                                fontSize: "11.5px",
                                color: n.read ? "#64748b" : "#cbd5e1",
                                marginTop: "3px",
                                lineHeight: "1.4",
                              }}
                            >
                              {n.message}
                            </p>

                            {/* Metadata Pill Line: Phone, Trigger, Sector */}
                            {(n.metadata?.userName || n.metadata?.userPhone || n.metadata?.triggerType || n.metadata?.district) && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                  marginTop: "6px",
                                }}
                              >
                                {n.metadata.userName && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      color: "#c4b5fd",
                                      background: "rgba(139, 92, 246, 0.15)",
                                      border: "1px solid rgba(139, 92, 246, 0.25)",
                                      padding: "1px 6px",
                                      borderRadius: "6px",
                                    }}
                                  >
                                    👤 {n.metadata.userName}
                                  </span>
                                )}
                                {n.metadata.userPhone && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      color: "#38bdf8",
                                      background: "rgba(56, 189, 248, 0.12)",
                                      border: "1px solid rgba(56, 189, 248, 0.22)",
                                      padding: "1px 6px",
                                      borderRadius: "6px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "3px",
                                    }}
                                  >
                                    <Phone size={9} />
                                    {n.metadata.userPhone}
                                  </span>
                                )}
                                {n.metadata.triggerType && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      color: "#f87171",
                                      background: "rgba(239, 68, 68, 0.12)",
                                      border: "1px solid rgba(239, 68, 68, 0.22)",
                                      padding: "1px 6px",
                                      borderRadius: "6px",
                                    }}
                                  >
                                    MODE: {String(n.metadata.triggerType).toUpperCase()}
                                  </span>
                                )}
                                {n.metadata.district && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      color: "#fb923c",
                                      background: "rgba(249, 115, 22, 0.12)",
                                      border: "1px solid rgba(249, 115, 22, 0.22)",
                                      padding: "1px 6px",
                                      borderRadius: "6px",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "3px",
                                    }}
                                  >
                                    <MapPin size={9} />
                                    {n.metadata.district}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Bottom row: Time + Action Buttons */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginTop: "8px",
                                paddingTop: "6px",
                                borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#64748b",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title={new Date(n.timestamp).toLocaleString("en-IN")}
                              >
                                <Clock size={10} />
                                {formatRelativeTime(n.timestamp)}
                              </span>

                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {/* Acknowledge button on active SOS alerts */}
                                {isSOS && !isAcked && !isResolved && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      acknowledgeAlertNotification(n.metadata?.alertId || n.id);
                                    }}
                                    style={{
                                      fontSize: "10.5px",
                                      fontWeight: 700,
                                      color: "#fbbf24",
                                      background: "rgba(245, 158, 11, 0.15)",
                                      border: "1px solid rgba(245, 158, 11, 0.35)",
                                      padding: "3px 8px",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "rgba(245, 158, 11, 0.3)";
                                      e.currentTarget.style.color = "#ffffff";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "rgba(245, 158, 11, 0.15)";
                                      e.currentTarget.style.color = "#fbbf24";
                                    }}
                                  >
                                    Acknowledge
                                  </button>
                                )}

                                {/* Jump Link */}
                                {n.link && (
                                  <button
                                    onClick={() => {
                                      markAsRead(n.id);
                                      setIsOpen(false);
                                      navigate(n.link!);
                                    }}
                                    style={{
                                      fontSize: "10.5px",
                                      fontWeight: 700,
                                      color: isSOS && !isResolved ? "#ffffff" : "#c4b5fd",
                                      background:
                                        isSOS && !isResolved
                                          ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                                          : "rgba(139, 92, 246, 0.15)",
                                      border:
                                        isSOS && !isResolved
                                          ? "1px solid rgba(239, 68, 68, 0.6)"
                                          : "1px solid rgba(139, 92, 246, 0.3)",
                                      padding: "3px 9px",
                                      borderRadius: "6px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      transition: "all 0.15s ease",
                                      boxShadow: isSOS && !isResolved ? "0 0 10px rgba(239, 68, 68, 0.4)" : "none",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.opacity = "0.9";
                                      e.currentTarget.style.transform = "translateY(-1px)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.opacity = "1";
                                      e.currentTarget.style.transform = "none";
                                    }}
                                  >
                                    <span>{isSOS ? "Respond / Map" : "Open"}</span>
                                    <ExternalLink size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
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
    </>
  );
};
