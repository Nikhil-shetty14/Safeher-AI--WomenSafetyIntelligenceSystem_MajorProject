/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  BrainCircuit, Zap, AlertTriangle, ShieldCheck,
  Download, Activity, Mic, Map as MapIcon,
  Crosshair, Server, RefreshCw, Wifi, WifiOff,
  ChevronDown, ChevronRight, Clock, Shield, BarChart as BarChartIcon
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { GoogleMap, useJsApiLoader, Circle } from '@react-google-maps/api';
import { useSocket } from "./SocketContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

/* ─── Status Colors ─── */
const STATUS_COLORS = {
  CRITICAL: { bg: "#fef2f2", border: "#fca5a5", text: "#dc2626", dot: "#ef4444" },
  HIGH:     { bg: "#fff7ed", border: "#fdba74", text: "#ea580c", dot: "#f97316" },
  MEDIUM:   { bg: "#fefce8", border: "#fde047", text: "#ca8a04", dot: "#eab308" },
  LOW:      { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", dot: "#22c55e" },
  ELEVATED: { bg: "#fff7ed", border: "#fdba74", text: "#ea580c", dot: "#f97316" },
  NORMAL:   { bg: "#f0fdf4", border: "#86efac", text: "#16a34a", dot: "#22c55e" },
} as Record<string, { bg: string; border: string; text: string; dot: string }>;

const getStatusColor = (level: string) =>
  STATUS_COLORS[level?.toUpperCase()] || STATUS_COLORS.LOW;

const getMarkerColor = (risk: string): string => {
  if (risk === "CRITICAL") return "#ef4444";
  if (risk === "HIGH") return "#f97316";
  if (risk === "MEDIUM") return "#eab308";
  return "#22c55e";
};

/* ─── Simple Skeleton ─── */
const Skeleton = ({ w = "100%", h = 16 }: { w?: string; h?: number }) => (
  <div
    style={{
      width: w, height: h, borderRadius: 8,
      background: "linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }}
  />
);

/* ─── Recharts Custom Tooltip ─── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "8px 12px" }}>
      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 600, margin: 0 }}>{label}</p>
      <p style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700, margin: "2px 0 0" }}>{payload[0].value} predicted</p>
    </div>
  );
};

/* ─── Card Component ─── */
const Card = ({
  children, style, className = "", noPadding = false
}: {
  children: React.ReactNode; style?: React.CSSProperties; className?: string; noPadding?: boolean;
}) => (
  <div
    className={className}
    style={{
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 16,
      padding: noPadding ? 0 : 24,
      ...style,
    }}
  >
    {children}
  </div>
);

const CardHeader = ({
  icon: Icon, iconColor, title, right
}: {
  icon: any; iconColor: string; title: string; right?: React.ReactNode;
}) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon size={18} style={{ color: iconColor }} />
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", margin: 0, letterSpacing: 0.3 }}>{title}</h3>
    </div>
    {right}
  </div>
);

/* ─── Tab Component ─── */
const TabBar = ({
  tabs, active, onChange
}: {
  tabs: string[]; active: string; onChange: (t: string) => void;
}) => (
  <div style={{ display: "flex", gap: 4, background: "#1e293b", borderRadius: 10, padding: 3 }}>
    {tabs.map(t => (
      <button
        key={t}
        onClick={() => onChange(t)}
        style={{
          padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 600, transition: "all 0.2s",
          background: active === t ? "#334155" : "transparent",
          color: active === t ? "#f1f5f9" : "#64748b",
        }}
      >
        {t}
      </button>
    ))}
  </div>
);

/* ─── Accordion ─── */
const Accordion = ({
  title, defaultOpen = false, children
}: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid #1e293b" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "12px 0", background: "none", border: "none", cursor: "pointer", color: "#cbd5e1",
          fontSize: 13, fontWeight: 600,
        }}
      >
        {title}
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  );
};

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
function AIIntelligenceCenterContent() {
  const libraries: any = ['visualization'];
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries
  });

  const getCachedStats = () => {
    try {
      const cached = localStorage.getItem("ai_intel_stats_cache");
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return null;
  };

  const initialStats = getCachedStats();
  const [loading, setLoading] = useState(!initialStats);
  const [stats, setStats] = useState<any>(initialStats);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialStats ? new Date() : null);
  const [refreshing, setRefreshing] = useState(false);
  const [bottomTab, setBottomTab] = useState("Voice");
  const { socket, connected: socketConnected } = useSocket();

  const fetchStats = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/ai/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setStats(data);
      try {
        localStorage.setItem("ai_intel_stats_cache", JSON.stringify(data));
      } catch (e) {}
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error("AI Intelligence fetch error:", err);
      if (!stats) {
        setError(err.message || "Failed to load AI intelligence data");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stats]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 45000);

    if (socket) {
      socket.on("new_sos_alert", fetchStats);
      socket.on("tactical_intel_update", fetchStats);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off("new_sos_alert", fetchStats);
        socket.off("tactical_intel_update", fetchStats);
      }
    };
  }, [fetchStats, socket]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ height: "100%", background: "#020617", padding: 32, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <BrainCircuit size={28} style={{ color: "#8b5cf6" }} />
          <Skeleton w="240px" h={28} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid #1e293b" }}>
              <Skeleton w="60%" h={12} />
              <div style={{ marginTop: 16 }}><Skeleton w="40%" h={28} /></div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid #1e293b", minHeight: 300 }}>
              <Skeleton w="50%" h={14} />
              <div style={{ marginTop: 24 }}><Skeleton h={200} /></div>
            </div>
          ))}
        </div>
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }

  const threatColor = getStatusColor(stats?.global_threat_level || "NORMAL");

  return (
    <div style={{ height: "100%", background: "#020617", overflowY: "auto", color: "#e2e8f0" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .aic-main-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; margin-bottom: 24px; }
        .aic-bottom-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 32px; }
        @media (max-width: 1024px) {
          .aic-main-grid { grid-template-columns: 1fr !important; }
          .aic-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ════════════ HEADER ════════════ */}
      <div style={{
        padding: "20px 32px",
        borderBottom: "1px solid #1e293b",
        background: "#0f172a",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BrainCircuit size={22} style={{ color: "#a78bfa" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f8fafc", margin: 0 }}>AI Intelligence Center</h1>
            <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", fontWeight: 500 }}>
              Powered by Ollama Phi-3 · Real-Time Threat Analysis
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 8,
            background: socketConnected ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${socketConnected ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          }}>
            {socketConnected
              ? <><Wifi size={13} style={{ color: "#22c55e" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>LIVE</span></>
              : <><WifiOff size={13} style={{ color: "#ef4444" }} /><span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>OFFLINE</span></>
            }
          </div>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
              <Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={refreshing}
            style={{
              padding: "7px 10px", borderRadius: 8, border: "1px solid #334155",
              background: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center",
            }}
          >
            <RefreshCw size={15} style={{ color: "#94a3b8", animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </button>
          <button style={{
            padding: "8px 18px", borderRadius: 8,
            background: "#7c3aed", color: "#fff", border: "none",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: 1600, margin: "0 auto" }}>

        {/* Error Banner */}
        {error && (
          <div style={{
            padding: "12px 20px", borderRadius: 12, marginBottom: 20,
            background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#fca5a5", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertTriangle size={16} /> {error}
            <button onClick={fetchStats} style={{ marginLeft: "auto", background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>Retry</button>
          </div>
        )}

        {/* ════════════ ROW 1: TOP KPIs ════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>

          {/* Global Threat */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Global Threat</span>
              <AlertTriangle size={18} style={{ color: threatColor.dot }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={{
                display: "inline-block", padding: "6px 16px", borderRadius: 10,
                fontSize: 16, fontWeight: 800,
                background: `${threatColor.dot}18`, color: threatColor.dot,
                border: `1px solid ${threatColor.dot}40`,
              }}>
                {stats?.global_threat_level || "—"}
              </span>
            </div>
          </Card>

          {/* Avg Risk Score */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Risk Score</span>
              <Zap size={18} style={{ color: "#f59e0b" }} />
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#f8fafc" }}>{stats?.average_risk_score ?? 0}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>/100</span>
            </div>
            <div style={{ marginTop: 10, height: 6, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99, transition: "width 1s ease",
                width: `${stats?.average_risk_score ?? 0}%`,
                background: (stats?.average_risk_score ?? 0) > 70 ? "#ef4444" : (stats?.average_risk_score ?? 0) > 40 ? "#f59e0b" : "#22c55e",
              }} />
            </div>
          </Card>

          {/* AI Confidence */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>AI Confidence</span>
              <ShieldCheck size={18} style={{ color: "#22c55e" }} />
            </div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#f8fafc" }}>{stats?.ai_confidence_index ?? 0}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>%</span>
            </div>
            <p style={{ marginTop: 8, fontSize: 11, color: "#64748b", fontWeight: 500 }}>Analysis certainty index</p>
          </Card>

          {/* AI Engine */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>AI Engine</span>
              <Server size={18} style={{ color: "#8b5cf6" }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#c4b5fd" }}>
                {stats?.model_monitoring?.model_name ?? "—"}
              </span>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Latency</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{stats?.model_monitoring?.latency_ms ?? "—"} ms</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Uptime</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>{stats?.model_monitoring?.uptime ?? "—"}</div>
              </div>
            </div>
          </Card>
        </div>

        {/* ════════════ ROW 2: MAIN — SOS + HEATMAP (large) ════════════ */}
        <div className="aic-main-grid">

          {/* Live SOS AI Analysis — large card */}
          <Card noPadding style={{ display: "flex", flexDirection: "column", minHeight: 440 }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #1e293b",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} style={{ color: "#ef4444" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Live SOS AI Analysis</h3>
              </div>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                animation: (stats?.live_sos_analysis?.length > 0) ? "pulse-dot 2s infinite" : "none",
              }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {stats?.live_sos_analysis?.length > 0 ? stats.live_sos_analysis.map((sos: any, i: number) => {
                const riskColor = sos.risk > 75 ? "#ef4444" : sos.risk > 50 ? "#f59e0b" : "#22c55e";
                return (
                  <div key={i} style={{
                    padding: 14, borderRadius: 12, marginBottom: 12,
                    background: "#1e293b", border: "1px solid #334155",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#8b5cf6" }}>SOS-{sos.id}</span>
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>{sos.time}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 10px" }}>{sos.tactical_summary}</p>
                    {sos.source === 'voice' && sos.audio_url && (
                      <audio controls style={{ width: "100%", marginTop: 4 }} src={sos.audio_url} />
                    )}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: 8, background: "#0f172a",
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Risk Score</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: riskColor }}>{sos.risk}/100</span>
                    </div>
                  </div>
                );
              }) : (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <ShieldCheck size={36} style={{ color: "#22c55e", opacity: 0.4, margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>No active SOS alerts</p>
                  <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>All clear in your jurisdiction</p>
                </div>
              )}
            </div>
          </Card>

          {/* AI Risk Heatmap — large card */}
          <Card noPadding style={{ display: "flex", flexDirection: "column", minHeight: 440 }}>
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #1e293b",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={16} style={{ color: "#ef4444" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>AI Risk Heatmap</h3>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Critical", color: "#ef4444" },
                  { label: "High", color: "#f97316" },
                  { label: "Medium", color: "#eab308" },
                  { label: "Low", color: "#22c55e" },
                ].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 350 }}>
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ height: "100%", width: "100%", borderRadius: "0 0 16px 16px" }}
                  center={{ lat: 12.9716, lng: 77.5946 }}
                  zoom={11}
                  options={{
                    styles: [
                      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
                      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
                      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
                      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
                      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
                    ],
                    disableDefaultUI: true,
                  }}
                >
                  {stats?.active_hotspots?.map((spot: any, i: number) => (
                    <Circle
                      key={i}
                      center={{ lat: spot.coords[0], lng: spot.coords[1] }}
                      radius={spot.risk === "CRITICAL" ? 2000 : spot.risk === "HIGH" ? 1500 : 1000}
                      options={{
                        fillColor: getMarkerColor(spot.risk),
                        fillOpacity: 0.4,
                        strokeColor: getMarkerColor(spot.risk),
                        strokeWeight: 2,
                      }}
                    />
                  ))}
                </GoogleMap>
              ) : (
                <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                  <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", opacity: 0.5 }} />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ════════════ ROW 3: TABBED DETAIL SECTION ════════════ */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", margin: 0 }}>Intelligence Modules</h3>
            <TabBar
              tabs={["Voice", "Predictive", "Behaviour", "Resources"]}
              active={bottomTab}
              onChange={setBottomTab}
            />
          </div>

          {/* Voice Intelligence */}
          {bottomTab === "Voice" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div style={{ padding: 20, borderRadius: 12, background: "#1e293b", textAlign: "center" }}>
                <Mic size={24} style={{ color: "#f59e0b", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 28, fontWeight: 800, color: "#f8fafc" }}>{stats?.voice_analysis?.stress_markers_detected ?? 0}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4, textTransform: "uppercase" }}>Stress Markers</div>
              </div>
              <div style={{ padding: 20, borderRadius: 12, background: "#1e293b", textAlign: "center" }}>
                <Shield size={24} style={{ color: "#ef4444", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fca5a5" }}>{stats?.voice_analysis?.primary_emotion ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4, textTransform: "uppercase" }}>Primary Emotion</div>
              </div>
              <div style={{ padding: 20, borderRadius: 12, background: "#1e293b", textAlign: "center" }}>
                <BarChartIcon size={24} style={{ color: "#8b5cf6", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 28, fontWeight: 800, color: "#c4b5fd" }}>{stats?.voice_analysis?.accuracy ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4, textTransform: "uppercase" }}>AI Audio Accuracy</div>
              </div>
            </div>
          )}

          {/* Predictive Risk */}
          {bottomTab === "Predictive" && (
            <div>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Predicted incident volume over upcoming time windows (Ollama Phi-3 analysis)</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.predictive_analytics || []} barCategoryGap="25%">
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,0.06)" }} />
                    <Bar dataKey="predicted_incidents" radius={[6, 6, 0, 0]} barSize={36}>
                      {(stats?.predictive_analytics || []).map((_: any, index: number) => (
                        <Cell
                          key={index}
                          fill={
                            (stats?.predictive_analytics?.[index]?.predicted_incidents ?? 0) > 15 ? "#ef4444" :
                            (stats?.predictive_analytics?.[index]?.predicted_incidents ?? 0) > 8 ? "#f59e0b" : "#38bdf8"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Behaviour Intelligence (Complaints) */}
          {bottomTab === "Behaviour" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { label: "Processed Today", value: stats?.complaint_intelligence?.total_processed ?? 0, color: "#f8fafc" },
                { label: "Current Sentiment", value: stats?.complaint_intelligence?.sentiment ?? "—", color: stats?.complaint_intelligence?.sentiment === "Negative" ? "#ef4444" : "#f59e0b" },
                { label: "Top Keyword", value: stats?.complaint_intelligence?.top_keyword ?? "—", color: "#8b5cf6" },
                { label: "Critical Unresolved", value: stats?.complaint_intelligence?.unresolved_critical ?? 0, color: "#ef4444" },
              ].map((item, i) => (
                <div key={i} style={{ padding: 20, borderRadius: 12, background: "#1e293b" }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Emergency Resources */}
          {bottomTab === "Resources" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {stats?.resource_allocation?.map((res: any, i: number) => (
                <div key={i} style={{
                  padding: 16, borderRadius: 12, background: "#1e293b",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>{res.unit}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <MapIcon size={11} /> {res.location}
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 700,
                    textTransform: "uppercase",
                    background: res.status === "Deployed" ? "rgba(59,130,246,0.15)" : "rgba(100,116,139,0.15)",
                    color: res.status === "Deployed" ? "#60a5fa" : "#94a3b8",
                  }}>
                    {res.status}
                  </span>
                </div>
              )) || (
                <p style={{ color: "#64748b", fontSize: 13 }}>No resource allocation data available.</p>
              )}
            </div>
          )}
        </Card>

        {/* ════════════ ROW 4: BOTTOM — Recommendations + Summary ════════════ */}
        <div className="aic-bottom-grid">

          {/* Tactical AI Recommendations */}
          <Card>
            <CardHeader icon={Crosshair} iconColor="#8b5cf6" title="Tactical AI Recommendations" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stats?.ai_recommendations?.length > 0 ? stats.ai_recommendations.map((rec: string, i: number) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "12px 14px", borderRadius: 10,
                  background: "rgba(139, 92, 246, 0.06)", border: "1px solid rgba(139, 92, 246, 0.12)",
                }}>
                  <ShieldCheck size={14} style={{ color: "#a78bfa", marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, margin: 0 }}>{rec}</p>
                </div>
              )) : (
                <p style={{ fontSize: 13, color: "#475569", textAlign: "center", padding: "24px 0" }}>
                  No recommendations generated yet. AI engine will analyze when new data arrives.
                </p>
              )}
            </div>
          </Card>

          {/* AI Incident Summary */}
          <Card>
            <CardHeader icon={BarChartIcon} iconColor="#38bdf8" title="AI Incident Summary" />
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Accordion title="Admin Performance" defaultOpen>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: "#1e293b", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Avg Response</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", marginTop: 4 }}>{stats?.admin_performance?.avg_response_time_sec ?? 0}s</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "#1e293b", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Resolved</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#22c55e", marginTop: 4 }}>{stats?.admin_performance?.cases_resolved_today ?? 0}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "#1e293b", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>AI Assisted</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#c4b5fd", marginTop: 4 }}>{stats?.admin_performance?.ai_assisted_resolutions ?? "—"}</div>
                  </div>
                </div>
              </Accordion>

              <Accordion title="Recent Insights">
                {stats?.recent_insights?.length > 0 ? stats.recent_insights.map((insight: string, i: number) => (
                  <p key={i} style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: "0 0 6px", paddingLeft: 12, borderLeft: "2px solid #334155" }}>
                    {insight}
                  </p>
                )) : (
                  <p style={{ fontSize: 12, color: "#475569" }}>No recent insights available.</p>
                )}
              </Accordion>

              <Accordion title="Active Hotspots">
                {stats?.active_hotspots?.length > 0 ? stats.active_hotspots.map((spot: any, i: number) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: i < stats.active_hotspots.length - 1 ? "1px solid #1e293b" : "none",
                  }}>
                    <span style={{ fontSize: 12, color: "#cbd5e1" }}>{spot.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                      background: `${getMarkerColor(spot.risk)}18`, color: getMarkerColor(spot.risk),
                    }}>
                      {spot.risk}
                    </span>
                  </div>
                )) : (
                  <p style={{ fontSize: 12, color: "#475569" }}>No active hotspots detected.</p>
                )}
              </Accordion>
            </div>
          </Card>
        </div>

      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(239,68,68,0.6); }
          50% { opacity: 0.4; box-shadow: 0 0 16px rgba(239,68,68,0.8); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════ ERROR BOUNDARY ═══════════════════════ */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AI Intelligence Center caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "100%", background: "#020617", padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card style={{ maxWidth: 500, textAlign: 'center' }}>
            <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
            <h2 style={{ color: '#f8fafc', fontSize: 20, marginBottom: 12 }}>Intelligence Module Offline</h2>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>{this.state.error?.message || "An unexpected error occurred while loading the AI Intelligence Center."}</p>
            <button onClick={() => window.location.reload()} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Reload System
            </button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AIIntelligenceCenter() {
  return (
    <ErrorBoundary>
      <AIIntelligenceCenterContent />
    </ErrorBoundary>
  );
}
