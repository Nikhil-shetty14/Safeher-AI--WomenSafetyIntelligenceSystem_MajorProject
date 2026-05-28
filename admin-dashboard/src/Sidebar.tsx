import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Map as MapIcon,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
  Bell,
  Activity,
} from "lucide-react";
import { useAdminAuth } from "./AuthContext";

export default function Sidebar() {
  const { logout, user } = useAdminAuth();
  const collapsed = false;
  const width = 280;

  return (
    <div
      style={{
        ...s.sidebar,
        width,
      }}
    >
      <div style={s.brand}>
        <div style={s.logoCircle}>
          <ShieldCheck size={28} color="#fff" />
        </div>
        {!collapsed && (
          <div>
            <h2 style={s.brandTitle}>SafeHer AI</h2>
            <p style={s.brandSub}>Command Console</p>
          </div>
        )}
      </div>

      <div
        style={{
          height: "1px",
          background: "var(--border)",
          margin: "0 18px 22px",
        }}
      />

      <div style={{ ...s.navGroup, padding: collapsed ? "0 10px" : "0 12px" }}>
        {!collapsed && <p style={s.navLabel}>Primary Monitoring</p>}
        <NavItem
          collapsed={collapsed}
          to="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
        />
        <NavItem
          collapsed={collapsed}
          to="/map"
          icon={MapIcon}
          label="Live Tactical Map"
        />
        <NavItem
          collapsed={collapsed}
          to="/users"
          icon={Users}
          label="Personnel Registry"
        />
        <NavItem
          collapsed={collapsed}
          to="/alerts"
          icon={Bell}
          label="Emergency Alerts"
        />
      </div>

      <div style={{ ...s.navGroup, padding: collapsed ? "0 10px" : "0 12px" }}>
        {!collapsed && <p style={s.navLabel}>System Controls</p>}
        <NavItem
          collapsed={collapsed}
          to="/analytics"
          icon={Activity}
          label="System Analytics"
        />
        <NavItem
          collapsed={collapsed}
          to="/settings"
          icon={Settings}
          label="Console Settings"
        />
      </div>

      <div style={s.footer}>
        <div style={s.userCard}>
          <div style={s.avatar}>{user?.name?.[0] || "A"}</div>
          {!collapsed && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <p style={s.userName}>{user?.name || "Administrator"}</p>
              <p style={s.userRole}>Level 1 Operator</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          style={{
            ...s.logoutBtn,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <LogOut size={18} /> {!collapsed && <span>Terminate Session</span>}
        </button>
      </div>
    </div>
  );
}

const NavItem = ({ to, icon: Icon, label, collapsed }: any) => (
  <NavLink
    to={to}
    style={({ isActive }) => ({
      ...s.navItem,
      justifyContent: collapsed ? "center" : "flex-start",
      background: isActive
        ? "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)"
        : "transparent",
      color: isActive ? "#fff" : "#cbd5e1",
      border: isActive
        ? "1px solid rgba(139, 92, 246, 0.3)"
        : "1px solid transparent",
      boxShadow: isActive
        ? "0 8px 20px -6px rgba(139, 92, 246, 0.3)"
        : "none",
    })}
  >
    <Icon size={20} />
    {!collapsed && <span style={s.navLabelText}>{label}</span>}
  </NavLink>
);

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    height: "100vh",
    background: "var(--bg-panel)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    zIndex: 100,
    transition: "width 0.25s ease",
    overflow: "hidden",
  },
  brand: {
    padding: "24px 18px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  logoCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "14px",
    background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 20px rgba(139,92,246,0.45)",
  },
  brandTitle: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#fff",
    letterSpacing: "-0.5px",
  },
  brandSub: {
    fontSize: "11px",
    color: "#8b5cf6",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  navGroup: { marginBottom: "24px" },
  navLabel: {
    fontSize: "10px",
    color: "#94a3b8",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "12px",
    marginLeft: "12px",
  },
  navLabelText: { marginLeft: "12px", fontWeight: 600 },
  navItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    borderRadius: "12px",
    marginBottom: "6px",
    textDecoration: "none",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  footer: {
    marginTop: "auto",
    padding: "20px",
    borderTop: "1px solid var(--border)",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "#8b5cf6",
    border: "1px solid var(--border)",
  },
  userName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: { fontSize: "11px", color: "#94a3b8" },
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "10px",
    borderRadius: "12px",
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.08)",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
    transition: "all 0.2s ease",
  },
};
