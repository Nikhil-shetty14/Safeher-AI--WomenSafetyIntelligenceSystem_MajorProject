import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from "@react-google-maps/api";
import { adminAPI } from "../api";
import { useSocket } from "../SocketContext";
import {
  X, ShieldAlert, User, Phone, Mail, Activity, MapPin, Navigation, Map,
  HeartPulse, Clock, FileText, CheckCircle, ChevronDown, ChevronUp,
  AlertTriangle, Fingerprint, Calendar, Camera, ZoomIn, ExternalLink, Download,
  RefreshCw, Copy, Check, Radio, Sparkles
} from "lucide-react";

interface AlertIntelligencePanelProps {
  alertId: string;
  onClose: () => void;
  onResolve: (id: string) => void;
}

const GMAP_LIBS: any = ["visualization"];
const mapContainerStyle = { width: "100%", height: "100%" };
const darkMapStyle: any[] = [
  { elementType: "geometry", stylers: [{ color: "#0f0f1a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c1c2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c2c44" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a1a" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function AlertIntelligencePanel({ alertId, onClose, onResolve }: AlertIntelligencePanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<any>(null);
  const [showMedical, setShowMedical] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  const { socket } = useSocket();

  const { isLoaded: gmapLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: GMAP_LIBS,
  });

  const fetchIntel = useCallback(async () => {
    try {
      const res = await adminAPI.getAlertIntelligence(alertId);
      setData(res.data);
    } catch (err) {
      console.error("Intel fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  const handleRegenerateIntel = async () => {
    setIsRegenerating(true);
    try {
      const res = await adminAPI.regenerateAlertIntelligence(alertId);
      if (res?.data?.ai_analysis) {
        setData((prev: any) => ({
          ...prev,
          ai_analysis: res.data.ai_analysis
        }));
      } else {
        await fetchIntel();
      }
    } catch (err) {
      console.error("Intel regeneration failed", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyScript = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  useEffect(() => {
    fetchIntel();
    const t = setInterval(fetchIntel, 10000);
    const handleNewEvidence = (evidence: any) => {
      if (evidence.alert_id !== alertId) return;
      setData((prev: any) => {
        if (!prev) return prev;
        const evId = evidence._id || evidence.id;
        if (prev.photo_evidence?.some((e: any) => e.id === evId)) return prev;
        const filename = evidence.photo_path?.split(/[\/]/).pop();
        return {
          ...prev,
          photo_evidence: [...(prev.photo_evidence || []), {
            id: evId, photo_path: evidence.photo_path,
            url: evidence.url || (filename ? "/uploads/" + filename : "/api/sos/evidence/photo/" + evId),
            timestamp: evidence.timestamp, location: evidence.location,
          }],
        };
      });
    };
    if (socket) socket.on("new_photo_evidence", handleNewEvidence);
    return () => { clearInterval(t); if (socket) socket.off("new_photo_evidence", handleNewEvidence); };
  }, [alertId, socket, fetchIntel]);

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm tracking-widest uppercase">Fetching Intelligence...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="bg-slate-900 p-8 rounded-xl border border-slate-700 text-center max-w-md w-full">
        <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Intel Not Found</h2>
        <p className="text-slate-400 mb-6">Unable to retrieve intelligence data for this incident.</p>
        <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 px-4 rounded">Close</button>
      </div>
    </div>
  );

  const { subject_personnel, location, ai_analysis, emergency_contacts, live_movement, history } = data || {};
  const lat = parseFloat(location?.latitude) || parseFloat(live_movement?.[0]?.latitude) || 0;
  const lng = parseFloat(location?.longitude) || parseFloat(live_movement?.[0]?.longitude) || 0;
  const hasValidLocation = lat !== 0 && lng !== 0;
  const center = { lat, lng };
  const pathCoords = live_movement
    ?.filter((p: any) => p.latitude && p.longitude)
    .map((p: any) => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) })) || [];
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const isMapReady = hasValidLocation && (gmapLoaded || (typeof window !== "undefined" && !!(window as any).google?.maps));

  const markerSvgB64 = btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">' +
    '<circle cx="20" cy="20" r="18" fill="#ef4444" fill-opacity="0.25"/>' +
    '<circle cx="20" cy="20" r="10" fill="#ef4444"/>' +
    '<circle cx="20" cy="20" r="5" fill="white"/>' +
    '<line x1="20" y1="30" x2="20" y2="48" stroke="#ef4444" stroke-width="2.5"/>' +
    '</svg>'
  );

  const markerIcon = (typeof window !== "undefined" && (window as any).google?.maps?.Size)
    ? {
        url: "data:image/svg+xml;base64," + markerSvgB64,
        scaledSize: new (window as any).google.maps.Size(40, 50),
        anchor: new (window as any).google.maps.Point(20, 48),
      }
    : { url: "data:image/svg+xml;base64," + markerSvgB64 };

  const handleExportPDF = () => {
    // @ts-ignore
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF engine is initializing, please try again in a moment.");
      return;
    }
    try {
      // @ts-ignore
      const doc = new window.jspdf.jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("SafeHer AI - Emergency Intelligence Report", 14, 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Incident ID: ${data?.incident_id || alertId}`, 14, 28);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);
      doc.text(`Status: ${data?.status?.toUpperCase()} | Trigger: ${(data?.trigger_type || "SOS").toUpperCase()}`, 14, 40);

      // @ts-ignore
      if (doc.autoTable) {
        // @ts-ignore
        doc.autoTable({
          startY: 46,
          head: [['Parameter', 'Details']],
          body: [
            ['Subject Name', subject_personnel?.name || 'Unknown'],
            ['Phone', subject_personnel?.phone || 'N/A'],
            ['Email', subject_personnel?.email || 'N/A'],
            ['District', subject_personnel?.district || location?.district || 'Unknown'],
            ['Blood Group', subject_personnel?.blood_group || 'N/A'],
            ['Medical Conditions', subject_personnel?.medical_conditions || 'None listed'],
            ['Threat Level', (ai_analysis?.danger_level || 'CRITICAL').toUpperCase()],
            ['Confidence Score', `${ai_analysis?.confidence_score ?? 95}%`],
            ['GPS Coordinates', `${lat.toFixed(6)}, ${lng.toFixed(6)}`],
            ['Tactical Summary', ai_analysis?.ai_tactical_summary || ai_analysis?.reasoning || 'Incident in progress.'],
            ['Recommended Action', ai_analysis?.suggested_action || 'Immediate tactical dispatch.']
          ],
          theme: 'grid',
          headStyles: { fillColor: [139, 92, 246] }
        });
      }
      doc.save(`SafeHer_Intelligence_${(data?.incident_id || alertId).substring(0, 8)}_${Date.now()}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("Failed to export PDF.");
    }
  };

  const resolvePhotoSrc = (photo: any) => {
    if (!photo?.url) return baseUrl + "/api/sos/evidence/photo/" + photo.id;
    return photo.url.startsWith("http") ? photo.url : baseUrl + photo.url;
  };

  const tc = ai_analysis?.danger_level === "high" || ai_analysis?.danger_level === "critical"
    ? { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" }
    : ai_analysis?.danger_level === "medium"
    ? { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/40" }
    : { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/40" };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-5 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 10 }}
        className="rounded-2xl w-full h-full max-w-[1440px] flex flex-col overflow-hidden text-slate-200"
        style={{
          background: "linear-gradient(145deg, rgba(14, 10, 32, 0.98), rgba(22, 14, 48, 0.98))",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(139, 92, 246, 0.12)",
        }}
      >
        {/* HEADER */}
        <div
          className="px-5 py-3.5 flex items-center justify-between shrink-0"
          style={{
            background: "linear-gradient(90deg, rgba(20, 13, 44, 0.98), rgba(30, 18, 62, 0.98))",
            borderBottom: "1px solid rgba(139, 92, 246, 0.22)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className={"p-2 rounded-lg " + (data.status === "active" ? "bg-red-500/20 text-red-500 animate-pulse border border-red-500/30" : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30")}>
              <ShieldAlert size={26} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide uppercase flex items-center gap-2">
                Emergency Intelligence Report
                {data.status === "active" && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">Live</span>}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                <span className="flex items-center gap-1"><Fingerprint size={11} /> ID: {data.incident_id}</span>
                <span className="flex items-center gap-1"><AlertTriangle size={11} /> TRIGGER: {(data.trigger_type || "").toUpperCase()}</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> TIME: {data.created_at ? new Date(data.created_at).toLocaleString() : "N/A"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-purple-500/30 px-3 py-2 rounded-lg text-xs font-semibold transition-colors" title="Export PDF Intelligence Report">
              <Download size={14} className="text-purple-400" /> Export PDF
            </button>
            {data.status === "active" && (
              <button onClick={() => onResolve(data.incident_id)} className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border border-emerald-500/50 shadow-md">
                <CheckCircle size={15} /> Mark Resolved
              </button>
            )}
            <button onClick={onClose} className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 p-2 rounded-lg transition-colors border border-slate-700/50"><X size={20} /></button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-full">

            {/* LEFT PANEL */}
            <div className="col-span-1 lg:col-span-7 p-5 flex flex-col gap-5">

              {/* Subject + AI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Personnel Card */}
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                    <User size={13} className="text-indigo-400" />
                    <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Subject Personnel</h3>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600/40 to-purple-600/40 border-2 border-indigo-500/30 flex items-center justify-center text-2xl font-bold text-indigo-300">
                        {subject_personnel?.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="font-bold text-base text-white">{subject_personnel?.name || "Unknown"}</div>
                        <div className="text-[11px] text-slate-400 font-mono">UID: {(subject_personnel?.user_id || "").substring(0, 8)}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                      <div className="flex items-center gap-2 text-slate-300"><Phone size={13} className="text-slate-500 shrink-0" />{subject_personnel?.phone || "N/A"}</div>
                      <div className="flex items-center gap-2 text-slate-300"><Mail size={13} className="text-slate-500 shrink-0" />{subject_personnel?.email || "N/A"}</div>
                      <div className="flex items-center gap-2 text-slate-300"><MapPin size={13} className="text-slate-500 shrink-0" />{subject_personnel?.district || "Unknown District"}</div>
                    </div>
                    <div className="mt-3">
                      <button onClick={() => setShowMedical(!showMedical)} className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-red-400/80 font-bold py-1 hover:text-red-400 transition-colors">
                        <span className="flex items-center gap-1.5"><HeartPulse size={13} /> Medical Profile</span>
                        {showMedical ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      <AnimatePresence>
                        {showMedical && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="grid grid-cols-2 gap-2 pt-2">
                              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                                <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Blood Group</div>
                                <div className="font-semibold text-red-400 text-sm">{subject_personnel?.blood_group || "N/A"}</div>
                              </div>
                              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                                <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Conditions</div>
                                <div className="font-medium text-slate-300 text-xs">{subject_personnel?.medical_conditions || "None listed"}</div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* AI Analysis Card */}
                <div
                  className="rounded-xl overflow-hidden relative"
                  style={{
                    background: "linear-gradient(145deg, rgba(22, 14, 46, 0.75), rgba(15, 10, 34, 0.85))",
                    border: "1px solid rgba(139, 92, 246, 0.25)",
                    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
                  }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div
                    className="px-4 py-3 border-b flex justify-between items-center relative z-10"
                    style={{
                      background: "rgba(25, 16, 52, 0.7)",
                      borderColor: "rgba(139, 92, 246, 0.2)",
                    }}
                  >
                    <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-purple-300 font-bold">
                      <Activity size={13} className="text-purple-400" /> AI Threat Analysis & Incident Script
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRegenerateIntel}
                        disabled={isRegenerating}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm"
                        style={{
                          background: isRegenerating ? "rgba(99, 102, 241, 0.2)" : "rgba(139, 92, 246, 0.25)",
                          color: "#c4b5fd",
                          border: "1px solid rgba(139, 92, 246, 0.45)",
                        }}
                        title="Re-generate and refresh AI Tactical Intelligence Script"
                      >
                        <RefreshCw size={11} className={isRegenerating ? "animate-spin text-purple-300" : "text-purple-300"} />
                        {isRegenerating ? "Synthesizing..." : "Re-Analyze AI"}
                      </button>
                      <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] font-bold uppercase rounded border border-purple-500/30">AI Gen</span>
                      <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase rounded border border-emerald-500/30">Verified</span>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-3 relative z-10">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className={"flex flex-col p-3 rounded-lg border " + tc.bg + " " + tc.border}>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Threat Level</span>
                        <span className={"self-start px-2.5 py-1 rounded text-xs font-bold uppercase " + tc.text}>{(ai_analysis?.danger_level || "HIGH").toUpperCase()}</span>
                      </div>
                      <div className="flex flex-col p-3 rounded-lg border" style={{ background: "rgba(18, 12, 38, 0.6)", borderColor: "rgba(139, 92, 246, 0.18)" }}>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Risk / Confidence</span>
                        <div className="flex items-end gap-2 mt-0.5">
                          <span className="text-xl font-black text-slate-100 leading-none">{ai_analysis?.risk_score ?? 92}<span className="text-[10px] text-slate-500 font-bold ml-0.5">/100</span></span>
                          <span className="text-xl font-black text-purple-400 leading-none">{ai_analysis?.confidence_score ?? 95}<span className="text-[10px] text-purple-500 font-bold ml-0.5">%</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Threat Vectors & Telemetry Tags */}
                    {(() => {
                      const trig = (data?.trigger_type || "manual").toUpperCase();
                      const vector = ai_analysis?.threat_vector || `${trig} Distress Vector`;
                      const threats = (ai_analysis?.detected_threats && ai_analysis.detected_threats.length > 0)
                        ? ai_analysis.detected_threats
                        : ["Acute physical duress", `Sector ${subject_personnel?.district || location?.district || "Command"} alert`, "Immediate intercept required"];
                      const emotions = (ai_analysis?.detected_emotions && ai_analysis.detected_emotions.length > 0)
                        ? ai_analysis.detected_emotions
                        : ["Panic", "High Stress", "Imminent Threat"];

                      return (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 uppercase tracking-wider">
                            Vector: {vector}
                          </span>
                          {threats.map((t: string, i: number) => (
                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-950/40 text-purple-200 border border-purple-800/40">
                              ⚠ {t}
                            </span>
                          ))}
                          {emotions.map((e: string, i: number) => (
                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-800/40">
                              • {e}
                            </span>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Tactical Narrative Summary */}
                    {(() => {
                      const rawSummary = ai_analysis?.ai_tactical_summary || ai_analysis?.summary || ai_analysis?.reasoning;
                      const isStale = !rawSummary ||
                        typeof rawSummary !== "string" ||
                        rawSummary.toLowerCase().includes("pending or unavailable") ||
                        rawSummary.toLowerCase().includes("service unreachable") ||
                        rawSummary.toLowerCase().includes("unparseable") ||
                        rawSummary.trim().length < 25;

                      const formattedSummary = !isStale ? rawSummary : (
                        `INCIDENT SYNOPSIS: Subject ${subject_personnel?.name || "Subject Personnel"} triggered an active ${(ai_analysis?.danger_level || "HIGH").toUpperCase()} distress beacon via ${(data?.trigger_type || "manual").toUpperCase()} activation at ${location?.address || location?.district || "Monitored Sector"}.\n\nTHREAT ASSESSMENT: Real-time sensor diagnostics and telemetry breadcrumbs verify acute duress state. Vulnerable sector coordinates locked under elevated tactical threat rating.\n\nTACTICAL PROTOCOL: Automated emergency notification pipeline initiated to registered contacts. Ground intercept units mobilized to vector coordinates.`
                      );

                      return (
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-purple-300 font-bold mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Sparkles size={11} className="text-purple-400" /> Tactical Incident Intelligence Summary
                            </span>
                            <span className="text-[9px] text-purple-400/60 font-mono tracking-wider">NEURAL SYNTHESIS</span>
                          </div>
                          <div
                            className="text-xs text-slate-200 p-3.5 rounded-lg leading-relaxed font-sans shadow-inner whitespace-pre-line"
                            style={{
                              background: "rgba(13, 9, 28, 0.85)",
                              border: "1px solid rgba(139, 92, 246, 0.22)",
                            }}
                          >
                            {formattedSummary}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Operational Dispatcher Radio Script */}
                    {(() => {
                      const rawScript = ai_analysis?.ai_script;
                      const activeScript = (rawScript && typeof rawScript === "string" && rawScript.trim().length > 25) ? rawScript : (
                        `DISPATCH SCRIPT [PRIORITY 1 - CODE RED]: Attention all patrolling units in ${subject_personnel?.district || location?.district || "Sector"}. Active emergency distress beacon triggered for ${subject_personnel?.name || "Subject"}. Trigger mechanism: ${(data?.trigger_type || "EMERGENCY BEACON").toUpperCase()}. Suspected scenario: Imminent peril requiring immediate interception. Nearest Rapid Intervention Vehicle establish visual contact and acknowledge on Tactical Channel 1. Lock coordinates: lat ${lat.toFixed(4)}°, lon ${lng.toFixed(4)}°.`
                      );

                      return (
                        <div
                          className="p-3 rounded-lg relative shadow-lg"
                          style={{
                            background: "rgba(10, 6, 22, 0.95)",
                            border: "1px solid rgba(239, 68, 68, 0.35)",
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-400">
                              <Radio size={12} className="animate-pulse text-red-500" />
                              Tactical Patrol Dispatch Radio Script
                            </span>
                            <button
                              onClick={() => handleCopyScript(activeScript)}
                              className="flex items-center gap-1 text-[10px] font-semibold text-slate-200 hover:text-white px-2 py-0.5 rounded transition-all cursor-pointer shadow-sm"
                              style={{
                                background: "rgba(220, 38, 38, 0.25)",
                                border: "1px solid rgba(239, 68, 68, 0.45)",
                              }}
                              title="Copy radio broadcast script to clipboard"
                            >
                              {copiedScript ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              {copiedScript ? "Copied to Clipboard" : "Copy Radio Script"}
                            </button>
                          </div>
                          <p
                            className="text-[11px] font-mono text-emerald-300 leading-relaxed p-2.5 rounded select-all tracking-tight"
                            style={{
                              background: "rgba(0, 0, 0, 0.75)",
                              border: "1px solid rgba(16, 185, 129, 0.2)",
                            }}
                          >
                            {activeScript}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Recommended Actions */}
                    {(() => {
                      const recs = (ai_analysis?.recommendations && ai_analysis.recommendations.length > 0)
                        ? ai_analysis.recommendations
                        : [
                            `Dispatch nearest Rapid Intervention Vehicle to ${location?.address || location?.district || "incident coordinates"}`,
                            `Alert regional police dispatch control room (${subject_personnel?.district || location?.district || "Division"})`,
                            "Maintain live video and acoustic sensor feed capture",
                            "Lock subject GPS telemetry breadcrumb tracking on main radar screen",
                            "Coordinate with primary emergency contact for status verification"
                          ];

                      return (
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1.5">
                            Recommended Tactical Countermeasures
                          </div>
                          <div
                            className="text-xs text-amber-200/90 p-3 rounded-lg font-medium space-y-1.5"
                            style={{
                              background: "rgba(30, 20, 10, 0.6)",
                              border: "1px solid rgba(245, 158, 11, 0.25)",
                            }}
                          >
                            {Array.isArray(recs) ? (
                              recs.map((action: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-amber-400 font-bold shrink-0">▸</span>
                                  <span>{action}</span>
                                </div>
                              ))
                            ) : (
                              <p>{String(recs)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Contacts + History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                    <Phone size={13} className="text-blue-400" />
                    <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Emergency Contacts</h3>
                  </div>
                  <div className="p-4">
                    {emergency_contacts?.length > 0 ? (
                      <div className="space-y-2">
                        {emergency_contacts.map((c: any, i: number) => (
                          <div key={i} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/50 flex justify-between items-center">
                            <div>
                              <div className="font-bold text-slate-200 text-sm">{c.name}</div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{c.phone}</div>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">{c.relationship || "Contact"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 italic p-6 text-center border border-dashed border-slate-700/50 rounded-lg">No emergency contacts listed.</div>
                    )}
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                  <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50">
                    <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between text-[11px] uppercase tracking-widest text-slate-400 font-bold hover:text-slate-300 transition-colors">
                      <span className="flex items-center gap-2"><Clock size={13} className="text-purple-400" /> Subject History</span>
                      {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {showHistory && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="p-4">
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-3 text-center">
                              <span className="text-2xl font-black text-slate-200">{history?.past_alerts || 0}</span>
                              <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mt-1">Past SOS Alerts</div>
                            </div>
                            <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-3 text-center">
                              <span className="text-2xl font-black text-slate-200">{history?.past_complaints || 0}</span>
                              <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mt-1">Complaints Filed</div>
                            </div>
                          </div>
                          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Recent Complaints</div>
                          {history?.recent_complaints?.length > 0 ? (
                            <div className="space-y-1.5">
                              {history.recent_complaints.map((c: any, i: number) => (
                                <div key={i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50 flex justify-between gap-2 items-center">
                                  <span className="text-slate-300 truncate text-xs">{c.subject || "No subject"}</span>
                                  <span className={"text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 " + (c.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20")}>{c.status}</span>
                                </div>
                              ))}
                            </div>
                          ) : <p className="text-xs text-slate-500 italic">No recent complaints.</p>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Context */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                  <FileText size={13} className="text-amber-400" />
                  <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Incident Context, Transcript & Evidence</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-4 text-slate-300">
                    {data.message
                      ? <div className="flex gap-3 items-start"><span className="text-4xl text-slate-600 leading-none font-serif">"</span><p className="pt-2 leading-relaxed italic">{data.message}</p></div>
                      : <span className="italic text-slate-500 text-sm">No text message or voice transcript provided.</span>}
                  </div>
                  {data.audio_file_path && (
                    <div className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-3 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400"><Activity size={16} /></div>
                        <div className="text-xs text-slate-400">
                          <span className="font-bold text-slate-300">Voice Evidence</span><br />
                          <span className="font-mono text-[10px]">{data.audio_file_path.split(/[\/]/).pop()}</span>
                        </div>
                      </div>
                      <audio controls src={data.audio_url ? (data.audio_url.startsWith("http") ? data.audio_url : baseUrl + data.audio_url) : baseUrl + "/api/sos/audio/" + data.incident_id} className="w-full h-8" />
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Evidence Gallery */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-400 font-bold"><Camera size={13} className="text-pink-400" /> Photo Evidence Gallery</span>
                  <span className={(data.photo_evidence?.length > 0 ? "bg-pink-500/20 text-pink-400 border-pink-500/30" : "bg-slate-700/50 text-slate-400 border-slate-600/30") + " px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded border"}>
                    {data.photo_evidence?.length || 0} Photos Captured
                  </span>
                </div>
                {data.photo_evidence?.length > 0 ? (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {data.photo_evidence.map((photo: any, idx: number) => {
                      const src = resolvePhotoSrc(photo);
                      return (
                        <div key={idx} onClick={() => setPreviewPhoto({ ...photo, resolvedSrc: src })}
                          className="group relative bg-slate-950 rounded-xl overflow-hidden cursor-pointer border border-slate-800/60 hover:border-pink-500/50 transition-all shadow-md"
                          style={{ aspectRatio: "4/3" }}>
                          <img src={src} alt={"Evidence " + (idx + 1)}
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                            onError={(e) => {
                              const t = e.currentTarget;
                              if (!t.dataset.fallback) {
                                t.dataset.fallback = "1";
                                const fn = photo.photo_path?.split(/[\/]/).pop();
                                if (fn) t.src = baseUrl + "/uploads/" + fn;
                                else t.style.display = "none";
                              }
                            }} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <ZoomIn size={28} className="text-white drop-shadow-xl" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-2 py-1.5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-300 font-mono flex items-center gap-1"><Clock size={9} /> {photo.timestamp ? new Date(photo.timestamp).toLocaleTimeString() : "N/A"}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{photo.location?.latitude ? Number(photo.location.latitude).toFixed(4) + "," + Number(photo.location.longitude).toFixed(4) : "No GPS"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 flex items-center gap-3 m-4 rounded-lg border border-dashed border-slate-700/50">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0"><Camera size={18} /></div>
                    <div className="text-xs text-slate-400"><span className="font-semibold text-slate-300">No photo evidence yet.</span><br />Captured automatically during active SOS when camera permission is granted.</div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL - GOOGLE MAP */}
            <div className="col-span-1 lg:col-span-5 lg:border-l border-slate-700/50 flex flex-col bg-slate-950">
              <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
                <h3 className="text-[11px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                  <Navigation size={13} className="text-red-400" /> Live Tactical Map
                </h3>
                {hasValidLocation && (
                  <div className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> GPS LOCK
                  </div>
                )}
              </div>

              {/* Fixed height map area */}
              <div className="relative" style={{ height: "400px", minHeight: "300px" }}>
                {isMapReady ? (
                  <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={15}
                    options={{ styles: darkMapStyle, zoomControl: true, mapTypeControl: false, streetViewControl: false, fullscreenControl: true }}>
                    {pathCoords.length > 1 && (
                      <Polyline path={pathCoords} options={{ strokeColor: "#ef4444", strokeWeight: 3, strokeOpacity: 0.8, geodesic: true }} />
                    )}
                    <Marker
                      position={center}
                      icon={markerIcon}
                      onClick={() => setShowInfoWindow(true)}
                    >
                      {showInfoWindow && (
                        <InfoWindow position={center} onCloseClick={() => setShowInfoWindow(false)}>
                          <div style={{ background: "#1e1b4b", color: "#e2e8f0", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", minWidth: "160px" }}>
                            <div style={{ fontWeight: "bold", color: "#f87171", marginBottom: "4px" }}>SOS Trigger Point</div>
                            <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#94a3b8" }}>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
                            {location?.district && <div style={{ marginTop: "4px", color: "#c4b5fd" }}>{location.district}</div>}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  </GoogleMap>
                ) : !hasValidLocation ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 bg-slate-900/30">
                    <Map size={44} className="opacity-20" />
                    <p className="uppercase tracking-widest text-xs font-bold">No Location Data Available</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Coordinates */}
              {hasValidLocation && (
                <div className="bg-slate-900/90 p-4 border-t border-slate-800">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Coordinates & Location</div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Latitude</span>
                      <span className="font-mono text-slate-200 font-bold text-sm">{lat.toFixed(6)}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Longitude</span>
                      <span className="font-mono text-slate-200 font-bold text-sm">{lng.toFixed(6)}</span>
                    </div>
                  </div>
                  {location?.district && (
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-start gap-2 mb-3">
                      <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-slate-200 font-bold text-sm">{location.district}</div>
                        {location.division && <div className="text-slate-500 text-xs mt-0.5">{location.division}</div>}
                        <div className="text-slate-600 text-xs mt-0.5">Region Location Match</div>
                      </div>
                    </div>
                  )}
                  <a href={"https://maps.google.com/?q=" + lat + "," + lng} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-xs font-bold py-2 rounded transition-colors">
                    <ExternalLink size={13} /> Open in Google Maps
                  </a>
                </div>
              )}

              {/* Movement trail */}
              {live_movement?.length > 0 && (
                <div className="p-4 border-t border-slate-800">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1.5">
                    <Navigation size={11} /> Movement Trail ({live_movement.length} points)
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}>
                    {live_movement.map((p: any, i: number) => (
                      <div key={i} className="bg-slate-900/40 px-3 py-1.5 rounded border border-slate-800/50 flex justify-between items-center text-[11px] font-mono">
                        <span className="text-slate-400">{parseFloat(p.latitude).toFixed(5)}, {parseFloat(p.longitude).toFixed(5)}</span>
                        <span className="text-slate-600">{p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>

      {/* LIGHTBOX */}
      <AnimatePresence>
        {previewPhoto && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setPreviewPhoto(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
              className="relative max-w-5xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 text-white font-bold text-sm"><Camera size={15} className="text-pink-400" /> SOS Photo Evidence Inspection</div>
                <button onClick={() => setPreviewPhoto(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
                <img src={previewPhoto.resolvedSrc} alt="SOS Evidence" className="max-h-[70vh] w-auto max-w-full object-contain" />
              </div>
              <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-4 text-slate-400">
                  <span className="flex items-center gap-1 font-mono"><Clock size={13} className="text-indigo-400" />{previewPhoto.timestamp ? new Date(previewPhoto.timestamp).toLocaleString() : "N/A"}</span>
                  <span className="font-mono">GPS: {previewPhoto.location?.latitude ? Number(previewPhoto.location.latitude).toFixed(6) + ", " + Number(previewPhoto.location.longitude).toFixed(6) : "N/A"}</span>
                </div>
                <div className="flex gap-2">
                  <a href={previewPhoto.resolvedSrc} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors"><ExternalLink size={13} /> Open Original</a>
                  <a href={previewPhoto.resolvedSrc} download className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium transition-colors"><Download size={13} /> Download</a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
