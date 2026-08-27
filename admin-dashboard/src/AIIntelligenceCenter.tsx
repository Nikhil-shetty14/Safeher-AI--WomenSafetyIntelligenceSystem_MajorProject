import React, { useEffect, useState, useRef } from "react";
import {
  BrainCircuit, ShieldAlert, Zap, TrendingUp, AlertTriangle, ShieldCheck,
  Download, Activity, Mic, Users, Map as MapIcon, Database, CheckCircle,
  Crosshair, Server, FileText, RefreshCw, Wifi, WifiOff
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./index.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE;

/* ───────────────────────── Skeleton Loader ───────────────────────── */
const Skeleton = ({ className = "", h = "h-4" }: { className?: string; h?: string }) => (
  <div className={`${h} rounded bg-slate-800 animate-pulse ${className}`} />
);

const CardSkeleton = () => (
  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
    <Skeleton h="h-3" className="w-1/3" />
    <Skeleton h="h-8" className="w-1/2" />
    <Skeleton h="h-2" className="w-2/3" />
  </div>
);

/* ───────────────────────── Recharts Tooltip ───────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-black text-cyan-400">{payload[0].value} predicted</p>
    </div>
  );
};

/* ───────────────────────── Main Component ───────────────────────── */
export default function AIIntelligenceCenter() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/ai/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to load AI stats:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /* ── Initial fetch + Socket.IO ── */
  useEffect(() => {
    fetchStats();

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      const token = localStorage.getItem("token");
      // Register as admin so we get broadcasts
      socket.emit("register_user", {
        user_id: "dashboard-admin",
        role: localStorage.getItem("admin_role") || "admin",
      });
    });

    socket.on("disconnect", () => setSocketConnected(false));

    // Live event handlers — refetch on any critical event
    socket.on("new_sos_alert", () => fetchStats());
    socket.on("tactical_intel_update", () => fetchStats());
    socket.on("new_complaint", () => fetchStats());

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /* ── Risk Color Helpers ── */
  const getRiskColor = (risk: string) => {
    if (risk === "CRITICAL") return "text-red-500 bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    if (risk === "HIGH") return "text-orange-500 bg-orange-500/10 border-orange-500/30";
    if (risk === "MEDIUM") return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/30";
  };

  const getMarkerColor = (risk: string): string => {
    if (risk === "CRITICAL") return "#ef4444";
    if (risk === "HIGH") return "#f97316";
    if (risk === "MEDIUM") return "#f59e0b";
    return "#10b981";
  };

  const getThreatBadge = (level: string) => {
    const colors: Record<string, string> = {
      CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.3)]",
      ELEVATED: "bg-amber-500/20 text-amber-400 border-amber-500/40",
      NORMAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    };
    return colors[level] || colors.NORMAL;
  };

  /* ── Loading State ── */
  if (loading) {
    return (
      <div className="h-full bg-[#050811] text-slate-200 overflow-y-auto custom-scrollbar">
        <div className="border-b border-indigo-900/40 bg-[#070b17] px-6 py-4 sticky top-0 z-20 flex justify-between items-center shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-lg border border-indigo-500/30 flex items-center justify-center">
              <BrainCircuit className="text-indigo-400 animate-pulse" size={26} />
            </div>
            <div>
              <Skeleton h="h-6" className="w-64 mb-2" />
              <Skeleton h="h-3" className="w-40" />
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
                <Skeleton h="h-3" className="w-1/3" />
                <Skeleton h="h-32" />
                <Skeleton h="h-4" className="w-full" />
                <Skeleton h="h-4" className="w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#050811] text-slate-200 overflow-y-auto custom-scrollbar">
      {/* ══════════════════════ TOP HEADER ══════════════════════ */}
      <div className="border-b border-indigo-900/40 bg-[#070b17] px-6 py-4 sticky top-0 z-20 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-lg border border-indigo-500/30 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-indigo-500/20 blur-md"></div>
            <BrainCircuit className="text-indigo-400 relative z-10" size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide">STATE COMMAND CENTER</h1>
            <p className="text-indigo-400 mt-0.5 text-xs font-bold tracking-widest uppercase">
              Ollama Phi3:Mini • Real-Time Telemetry
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {/* Socket Status */}
          <div className="px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg flex items-center gap-2">
            {socketConnected ? (
              <><Wifi size={14} className="text-emerald-400" /><span className="text-emerald-400 font-bold text-xs">LIVE</span></>
            ) : (
              <><WifiOff size={14} className="text-red-400" /><span className="text-red-400 font-bold text-xs">OFFLINE</span></>
            )}
          </div>
          {/* Last Updated */}
          {lastUpdated && (
            <div className="px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
          {/* Refresh */}
          <button
            onClick={fetchStats}
            disabled={refreshing}
            className="px-3 py-2 bg-slate-900/80 border border-slate-700/50 rounded-lg hover:border-indigo-500/40 transition-colors"
          >
            <RefreshCw size={16} className={`text-slate-300 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {/* Export */}
          <button className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-colors shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <Download size={16} /> EXECUTIVE REPORT
          </button>
        </div>
      </div>

      <div className="p-6 w-full mx-auto space-y-6">

        {/* ══════════════════════ TOP KPIs ══════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Global Threat */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Global Threat</span>
              <AlertTriangle className="text-red-500" size={20} />
            </div>
            <div className="mt-4">
              <div className={`inline-block px-3 py-1 rounded-lg text-lg font-black border ${getThreatBadge(stats?.global_threat_level)}`}>
                {stats?.global_threat_level || "—"}
              </div>
            </div>
          </div>

          {/* Avg Risk Score */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Avg Risk Score</span>
              <Zap className="text-amber-500" size={20} />
            </div>
            <div className="mt-4">
              <div className="flex items-end gap-1">
                <h2 className="text-3xl font-black text-white">{stats?.average_risk_score ?? 0}</h2>
                <span className="text-slate-500 font-bold mb-1">/100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${stats?.average_risk_score ?? 0}%`,
                    background: (stats?.average_risk_score ?? 0) > 70 ? "#ef4444" : (stats?.average_risk_score ?? 0) > 40 ? "#f59e0b" : "#10b981",
                  }}
                />
              </div>
            </div>
          </div>

          {/* AI Confidence */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">AI Confidence</span>
              <ShieldCheck className="text-emerald-500" size={20} />
            </div>
            <div className="mt-4">
              <div className="flex items-end gap-1">
                <h2 className="text-3xl font-black text-white">{stats?.ai_confidence_index ?? 0}</h2>
                <span className="text-emerald-500 font-bold mb-1">%</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Analysis Certainty</p>
            </div>
          </div>

          {/* Active Units */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Active Units</span>
              <Users className="text-blue-500" size={20} />
            </div>
            <div className="mt-4">
              <div className="flex items-end gap-2">
                <h2 className="text-3xl font-black text-white">{stats?.resource_allocation?.length || 0}</h2>
                <span className="text-blue-400 font-bold mb-1 text-sm">Deployed</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Emergency Response</p>
            </div>
          </div>
        </div>

        {/* ══════════════════════ 3-COLUMN GRID ══════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Live SOS Analysis */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg overflow-hidden">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={16} className="text-red-500" /> Live SOS Analysis
                </h3>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              </div>
              <div className="p-4 flex-1 space-y-4 max-h-[320px] overflow-y-auto custom-scrollbar">
                {stats?.live_sos_analysis?.length > 0 ? stats.live_sos_analysis.map((sos: any, i: number) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-indigo-400">SOS-{sos.id}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{sos.time}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">{sos.tactical_summary}</p>
                    {sos.source === 'voice' && sos.audio_url && (
                      <audio controls className="w-full mt-2" src={sos.audio_url} />
                    )}
                    <div className="flex justify-between items-center bg-slate-900/80 p-2 rounded border border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Risk Score</span>
                      <span className={`text-sm font-black ${sos.risk > 75 ? "text-red-400" : sos.risk > 50 ? "text-amber-400" : "text-emerald-400"}`}>{sos.risk}/100</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <ShieldCheck size={32} className="text-emerald-500/40 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 font-medium">No active SOS alerts</p>
                    <p className="text-xs text-slate-600 mt-1">All clear in your jurisdiction</p>
                  </div>
                )}
              </div>
            </div>

            {/* Voice Stress Analysis */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <Mic size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Voice Stress Matrix</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-center">
                  <div className="text-2xl font-black text-amber-500">{stats?.voice_analysis?.stress_markers_detected ?? 0}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Stress Markers</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 text-center">
                  <div className="text-lg font-black text-rose-500 mt-1">{stats?.voice_analysis?.primary_emotion ?? "—"}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400 mt-1">Primary Emotion</div>
                </div>
                <div className="col-span-2 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-400">AI Audio Accuracy</span>
                  <span className="text-sm font-black text-indigo-300">{stats?.voice_analysis?.accuracy ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Complaint Intelligence */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Complaint Intel</h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: "Processed Today", value: stats?.complaint_intelligence?.total_processed ?? 0, color: "text-white" },
                  { label: "Current Sentiment", value: stats?.complaint_intelligence?.sentiment ?? "—", color: "text-red-400", isBadge: true },
                  { label: "Top Keyword", value: stats?.complaint_intelligence?.top_keyword ?? "—", color: "text-indigo-400" },
                  { label: "Critical Unresolved", value: stats?.complaint_intelligence?.unresolved_critical ?? 0, color: "text-red-500", isLast: true },
                ].map((item, i) => (
                  <div key={i} className={`flex justify-between items-center p-2 ${!item.isLast ? "border-b border-slate-800/50" : ""}`}>
                    <span className="text-xs text-slate-400">{item.label}</span>
                    {item.isBadge ? (
                      <span className={`text-xs font-bold ${item.color} px-2 py-1 bg-red-500/10 rounded`}>{item.value}</span>
                    ) : (
                      <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Karnataka District Risk Heatmap */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg overflow-hidden">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <MapIcon size={16} className="text-rose-500" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Risk Heatmap — Karnataka</h3>
              </div>
              <div style={{ height: 350 }}>
                <MapContainer
                  center={[12.9716, 77.5946]}
                  zoom={11}
                  scrollWheelZoom={true}
                  style={{ height: "100%", width: "100%", background: "#0a0f1c" }}
                  attributionControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  {stats?.active_hotspots?.map((spot: any, i: number) => (
                    <CircleMarker
                      key={i}
                      center={[spot.coords[0], spot.coords[1]]}
                      radius={spot.risk === "CRITICAL" ? 18 : spot.risk === "HIGH" ? 14 : 10}
                      pathOptions={{
                        color: getMarkerColor(spot.risk),
                        fillColor: getMarkerColor(spot.risk),
                        fillOpacity: 0.45,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div className="text-xs">
                          <strong>{spot.name}</strong><br />
                          Risk: <span style={{ color: getMarkerColor(spot.risk) }}>{spot.risk}</span><br />
                          Type: {spot.type}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              {/* Legend */}
              <div className="p-3 border-t border-slate-800 flex justify-center gap-4">
                {[
                  { label: "Critical", color: "#ef4444" },
                  { label: "High", color: "#f97316" },
                  { label: "Medium", color: "#f59e0b" },
                  { label: "Low", color: "#10b981" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-[10px] text-slate-400 font-bold">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tactical AI Recommendations */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <Crosshair size={16} className="text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tactical Recommendations</h3>
              </div>
              <div className="p-4 space-y-3">
                {stats?.ai_recommendations?.length > 0 ? stats.ai_recommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
                    <div className="mt-1 flex-shrink-0">
                      <CheckCircle size={14} className="text-indigo-400" />
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">{rec}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500 text-center py-4">No recommendations generated yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* Predictive Trends — Recharts */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <Database size={16} className="text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Predictive Trends</h3>
              </div>
              <div className="p-4" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.predictive_analytics || []} barCategoryGap="20%">
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                    <Bar dataKey="predicted_incidents" radius={[4, 4, 0, 0]}>
                      {(stats?.predictive_analytics || []).map((_: any, index: number) => (
                        <Cell
                          key={index}
                          fill={(stats?.predictive_analytics?.[index]?.predicted_incidents ?? 0) > 15 ? "#ef4444" : (stats?.predictive_analytics?.[index]?.predicted_incidents ?? 0) > 8 ? "#f59e0b" : "#22d3ee"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Resource Allocation */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <ShieldAlert size={16} className="text-blue-500" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Resource Allocation</h3>
              </div>
              <div className="p-4 space-y-3">
                {stats?.resource_allocation?.map((res: any, i: number) => (
                  <div key={i} className="flex flex-col p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-white">{res.unit}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        res.status === "Deployed" ? "bg-blue-500/20 text-blue-400" :
                        res.status === "Active Surveillance" ? "bg-indigo-500/20 text-indigo-400" :
                        "bg-slate-500/20 text-slate-400"
                      }`}>
                        {res.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapIcon size={10} /> {res.location}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ollama Node Status */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-4 border-b border-slate-800 flex items-center gap-2">
                <Server size={16} className="text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Ollama Node Status</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Model", value: stats?.model_monitoring?.model_name ?? "—", color: "text-indigo-400" },
                  { label: "Uptime", value: stats?.model_monitoring?.uptime ?? "—", color: "text-emerald-400" },
                  { label: "Latency", value: `${stats?.model_monitoring?.latency_ms ?? "—"} ms`, color: "text-white" },
                  { label: "Tokens", value: stats?.model_monitoring?.tokens_processed ?? "—", color: "text-white" },
                ].map((m, i) => (
                  <div key={i} className="flex flex-col p-2 bg-slate-800/40 rounded border border-slate-700/50">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">{m.label}</span>
                    <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin Performance */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col shadow-lg">
              <div className="bg-[#0a0f1c] p-3 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin Performance</h3>
                <span className="text-xs font-black text-indigo-400">{stats?.admin_performance?.ai_assisted_resolutions ?? "—"} AI Assisted</span>
              </div>
              <div className="p-3 flex justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Avg Response</div>
                  <div className="text-sm font-bold text-white">{stats?.admin_performance?.avg_response_time_sec ?? 0} sec</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Resolved Today</div>
                  <div className="text-sm font-bold text-white">{stats?.admin_performance?.cases_resolved_today ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
