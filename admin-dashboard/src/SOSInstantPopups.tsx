import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  MapPin,
  User,
  Phone,
  Eye,
  CheckCircle,
  X,
  Radio,
  Flame,
} from "lucide-react";
import { useSOSAlerts } from "./SOSAlertContext";
import type { SOSPopupItem } from "./SOSAlertContext";

export const SOSInstantPopups: React.FC = () => {
  const { popups, dismissPopup, viewSOS, acknowledgeAlert } = useSOSAlerts();

  if (!popups || popups.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "76px",
        right: "24px",
        zIndex: 10001,
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        maxWidth: "420px",
        width: "calc(100vw - 48px)",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {popups.map((item) => (
          <SOSPopupCard
            key={item.id}
            item={item}
            onDismiss={() => dismissPopup(item.id)}
            onView={() => viewSOS(item.id)}
            onAcknowledge={() => acknowledgeAlert(item.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface SOSPopupCardProps {
  item: SOSPopupItem;
  onDismiss: () => void;
  onView: () => void;
  onAcknowledge: () => void;
}

const SOSPopupCard: React.FC<SOSPopupCardProps> = ({
  item,
  onDismiss,
  onView,
  onAcknowledge,
}) => {
  const { alert } = item;
  const isCritical = alert.severity === "critical";
  const isHigh = alert.severity === "high";

  const formatCoords = () => {
    const lat = alert.location?.latitude ?? alert.location?.lat;
    const lng = alert.location?.longitude ?? alert.location?.lng;
    if (lat !== undefined && lng !== undefined) {
      return `${Number(lat).toFixed(4)}°, ${Number(lng).toFixed(4)}°`;
    }
    return null;
  };

  const coordsText = formatCoords();
  const addressText = alert.location?.address;
  const districtText = alert.location?.district;
  const divisionText = alert.location?.division;

  const locationSummary =
    addressText ||
    (districtText
      ? `${districtText}${divisionText ? `, ${divisionText}` : ""}`
      : coordsText || "Live Coordinates Transmitting");

  return (
    <motion.div
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{
        pointerEvents: "auto",
        background: isCritical
          ? "linear-gradient(135deg, rgba(35, 10, 18, 0.96) 0%, rgba(18, 8, 22, 0.98) 100%)"
          : "linear-gradient(135deg, rgba(24, 16, 42, 0.96) 0%, rgba(12, 10, 26, 0.98) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "16px",
        border: isCritical
          ? "2px solid rgba(239, 68, 68, 0.85)"
          : isHigh
          ? "1.5px solid rgba(249, 115, 22, 0.75)"
          : "1px solid rgba(139, 92, 246, 0.4)",
        boxShadow: isCritical
          ? "0 14px 40px -8px rgba(239, 68, 68, 0.5), 0 0 25px rgba(239, 68, 68, 0.3)"
          : "0 12px 35px -8px rgba(0, 0, 0, 0.7), 0 0 15px rgba(139, 92, 246, 0.2)",
        padding: "16px",
        overflow: "hidden",
        position: "relative",
      }}
      className={isCritical ? "sos-popup-critical" : ""}
    >
      {/* Top Banner Stripe for Critical Alerts */}
      {isCritical && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #ef4444, #f97316, #ef4444)",
            animation: "pulse 2s infinite",
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              background: isCritical
                ? "rgba(239, 68, 68, 0.2)"
                : isHigh
                ? "rgba(249, 115, 22, 0.2)"
                : "rgba(139, 92, 246, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${
                isCritical
                  ? "rgba(239, 68, 68, 0.4)"
                  : isHigh
                  ? "rgba(249, 115, 22, 0.4)"
                  : "rgba(139, 92, 246, 0.3)"
              }`,
            }}
          >
            {isCritical ? (
              <ShieldAlert size={18} color="#ef4444" className="animate-pulse" />
            ) : isHigh ? (
              <Flame size={18} color="#f97316" />
            ) : (
              <AlertTriangle size={18} color="#a855f7" />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "0.4px",
                }}
              >
                {isCritical ? "CRITICAL SOS ALERT" : "EMERGENCY SOS ALERT"}
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  padding: "2px 7px",
                  borderRadius: "6px",
                  textTransform: "uppercase",
                  background: isCritical
                    ? "#ef4444"
                    : isHigh
                    ? "#f97316"
                    : "#8b5cf6",
                  color: "#fff",
                  letterSpacing: "0.5px",
                  boxShadow: isCritical
                    ? "0 0 10px rgba(239, 68, 68, 0.7)"
                    : "none",
                }}
              >
                {alert.severity}
              </span>
              {alert.trigger_type === "stealth" && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                    background: "rgba(168, 85, 247, 0.25)",
                    border: "1px solid rgba(168, 85, 247, 0.5)",
                    color: "#c084fc",
                    letterSpacing: "0.5px",
                  }}
                >
                  STEALTH
                </span>
              )}
              {(alert.trigger_type === "voice" || alert.trigger_type === "voice_intelligence") && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                    background: "rgba(16, 185, 129, 0.25)",
                    border: "1px solid rgba(16, 185, 129, 0.5)",
                    color: "#34d399",
                    letterSpacing: "0.5px",
                  }}
                >
                  VOICE AI
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                marginTop: "2px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Radio size={12} color="#10b981" />
              Real-Time Incident Stream
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "8px",
            color: "#94a3b8",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title="Dismiss Popup"
          aria-label="Dismiss popup"
        >
          <X size={14} />
        </button>
      </div>

      {/* Details Box */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          borderRadius: "10px",
          padding: "10px 12px",
          marginBottom: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* User Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <User size={14} color="#8b5cf6" />
          <span style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: 600 }}>
            {alert.user_name || "Emergency User"}
          </span>
          {alert.user_phone && (
            <span
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                marginLeft: "auto",
              }}
            >
              <Phone size={11} /> {alert.user_phone}
            </span>
          )}
        </div>

        {/* Location Info */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <MapPin
            size={14}
            color={isCritical ? "#ef4444" : "#f97316"}
            style={{ marginTop: "2px", flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "12px",
                color: "#f1f5f9",
                fontWeight: 500,
                lineHeight: "1.3",
                wordBreak: "break-word",
              }}
            >
              {locationSummary}
            </p>
            {coordsText && addressText && (
              <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                {coordsText}
              </p>
            )}
          </div>
        </div>

        {/* Message / Trigger */}
        {alert.message && (
          <div
            style={{
              fontSize: "11px",
              color: "#cbd5e1",
              fontStyle: "italic",
              marginTop: "2px",
              borderLeft: "2px solid rgba(139, 92, 246, 0.5)",
              paddingLeft: "8px",
            }}
          >
            "{alert.message}"
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onView}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            padding: "9px 14px",
            borderRadius: "10px",
            background: isCritical
              ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
              : "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "0.4px",
            border: "none",
            cursor: "pointer",
            boxShadow: isCritical
              ? "0 4px 15px rgba(239, 68, 68, 0.45)"
              : "0 4px 15px rgba(139, 92, 246, 0.35)",
            transition: "all 0.2s ease",
          }}
        >
          <Eye size={15} /> View SOS
        </button>

        <button
          onClick={onAcknowledge}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "9px 14px",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "#cbd5e1",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          title="Acknowledge and mark reviewed"
        >
          <CheckCircle size={15} color="#10b981" /> Acknowledge
        </button>
      </div>
    </motion.div>
  );
};
