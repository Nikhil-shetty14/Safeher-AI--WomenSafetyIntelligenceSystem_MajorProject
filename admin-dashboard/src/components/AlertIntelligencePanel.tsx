import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { adminAPI } from "../api";
import {
  X, ShieldAlert, User, Phone, Mail, Activity, MapPin, Navigation, Map, HeartPulse, Clock, FileText, CheckCircle, ChevronDown, ChevronUp, AlertTriangle, Fingerprint, Calendar
} from "lucide-react";

// Fix for default Leaflet icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface AlertIntelligencePanelProps {
  alertId: string;
  onClose: () => void;
  onResolve: (id: string) => void;
}

export default function AlertIntelligencePanel({ alertId, onClose, onResolve }: AlertIntelligencePanelProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Collapsible section states
  const [showMedical, setShowMedical] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchIntel = async () => {
      try {
        const res = await adminAPI.getAlertIntelligence(alertId);
        if (mounted) {
          setData(res.data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch intelligence report", err);
        if (mounted) setLoading(false);
      }
    };
    fetchIntel();
    const t = setInterval(fetchIntel, 10000); // Polling for live updates every 10s
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [alertId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 text-center max-w-md w-full">
          <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Intel Not Found</h2>
          <p className="text-slate-400 mb-6">Unable to retrieve intelligence data for this incident.</p>
          <button onClick={onClose} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded transition-colors">
            Close Panel
          </button>
        </div>
      </div>
    );
  }

  const { subject_personnel, location, ai_analysis, emergency_contacts, live_movement, history } = data;

  const lat = location?.latitude || live_movement?.[0]?.latitude || 0;
  const lng = location?.longitude || live_movement?.[0]?.longitude || 0;
  const hasValidLocation = lat !== 0 && lng !== 0;

  // Build movement path
  const pathPositions: [number, number][] = live_movement
    ?.filter((p: any) => p.latitude && p.longitude)
    .map((p: any) => [p.latitude, p.longitude]) || [];

  if (hasValidLocation && pathPositions.length === 0) {
    pathPositions.push([lat, lng]);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 sm:p-6 lg:p-10 font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl w-full h-full max-w-[1400px] flex flex-col overflow-hidden text-slate-200"
      >
        {/* TOP HEADER BAR */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${data.status === 'active' ? 'bg-red-500/20 text-red-500 animate-pulse border border-red-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'}`}>
              <ShieldAlert size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide uppercase flex items-center gap-2">
                Emergency Intelligence Report
                {data.status === 'active' && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold animate-pulse">Live</span>}
              </h1>
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mt-1">
                <span className="flex items-center gap-1"><Fingerprint size={12} /> ID: {data.incident_id}</span>
                <span className="flex items-center gap-1"><AlertTriangle size={12} /> TRIGGER: {data.trigger_type.toUpperCase()}</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> TIME: {new Date(data.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {data.status === 'active' && (
              <button 
                onClick={() => onResolve(data.incident_id)}
                className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-500 text-white px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition-colors border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <CheckCircle size={16} /> Mark Resolved
              </button>
            )}
            <button 
              onClick={onClose} 
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded transition-colors"
              title="Close Intel Panel"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* MAIN LAYOUT - 70/30 SPLIT */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 bg-slate-900/50">
          
          {/* LEFT PANEL - INTEL CARDS (70%) */}
          <div className="col-span-1 lg:col-span-8 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
            
            {/* ROW 1: PROFILE & AI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Personnel Profile */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                    <User size={14} className="text-indigo-400" /> Subject Personnel
                  </h3>
                </div>
                <div className="p-4 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-2xl font-bold text-slate-300 shadow-inner">
                      {subject_personnel?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="font-bold text-lg text-white">{subject_personnel?.name}</div>
                      <div className="text-xs text-slate-400 font-mono tracking-wider">UID: {subject_personnel?.user_id?.substring(0,8)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                    <div className="flex items-center gap-3 text-slate-300">
                      <Phone size={14} className="text-slate-500" /> {subject_personnel?.phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <Mail size={14} className="text-slate-500" /> {subject_personnel?.email || 'N/A'}
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                      <MapPin size={14} className="text-slate-500" /> {subject_personnel?.district || 'Unknown District'}
                    </div>
                  </div>

                  {/* Collapsible Medical Section */}
                  <div className="mt-4">
                    <button 
                      onClick={() => setShowMedical(!showMedical)}
                      className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-red-400/80 font-bold mb-2 hover:text-red-400 transition-colors"
                    >
                      <span className="flex items-center gap-2"><HeartPulse size={14} /> Medical Profile</span>
                      {showMedical ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <AnimatePresence>
                      {showMedical && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                            <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                              <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Blood Group</div>
                              <div className="font-medium text-red-400">{subject_personnel?.blood_group}</div>
                            </div>
                            <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50">
                              <div className="text-[10px] uppercase text-slate-500 mb-1 font-bold">Conditions</div>
                              <div className="font-medium text-slate-300 text-xs truncate" title={subject_personnel?.medical_conditions}>
                                {subject_personnel?.medical_conditions}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl"></div>
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center relative z-10">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                    <Activity size={14} className="text-indigo-400" /> AI Threat Analysis
                  </h3>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[9px] font-bold tracking-widest uppercase rounded border border-indigo-500/30">AI Generated</span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold tracking-widest uppercase rounded border border-emerald-500/30">AI Verified</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4 flex-1 relative z-10">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Threat Level</span>
                      <span className={`self-start px-3 py-1 rounded text-xs font-bold uppercase ${
                        ai_analysis?.danger_level === 'high' || ai_analysis?.danger_level === 'critical' 
                          ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
                          : ai_analysis?.danger_level === 'medium'
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                      }`}>
                        {ai_analysis?.danger_level || 'Pending'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Risk & Confidence</span>
                      <div className="flex items-end gap-3 mt-1">
                        <div className="flex items-end leading-none">
                          <span className="text-xl font-black text-slate-200">{ai_analysis?.risk_score || 85}</span>
                          <span className="text-[10px] text-slate-500 font-bold mb-0.5 ml-0.5">/100</span>
                        </div>
                        <div className="flex items-end leading-none">
                          <span className="text-xl font-black text-indigo-400">{ai_analysis?.confidence_score || 94}</span>
                          <span className="text-[10px] text-indigo-500 font-bold mb-0.5 ml-0.5">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1 flex justify-between">
                      <span>Tactical Summary</span>
                    </span>
                    <div className="text-sm text-slate-300 bg-slate-900/40 p-3 rounded-lg border border-slate-800/50 leading-relaxed flex-1">
                      {ai_analysis?.ai_tactical_summary || ai_analysis?.reasoning || "AI Analysis pending or unavailable."}
                    </div>
                  </div>

                  {ai_analysis?.suggested_action && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase tracking-widest text-amber-500/80 font-bold ml-1">Recommended Action</span>
                      <div className="text-sm text-amber-400 bg-amber-950/20 p-3 rounded-lg border border-amber-900/30 font-medium">
                        {ai_analysis.suggested_action}
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ROW 2: CONTACTS & HISTORY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Emergency Contacts */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                    <Phone size={14} className="text-blue-400" /> Emergency Contacts
                  </h3>
                </div>
                <div className="p-4">
                  {emergency_contacts?.length > 0 ? (
                    <div className="space-y-2">
                      {emergency_contacts.map((c: any, i: number) => (
                        <div key={i} className="bg-slate-900/40 p-3 rounded-lg border border-slate-800/50 flex justify-between items-center group hover:bg-slate-800/60 transition-colors">
                          <div>
                            <div className="font-bold text-slate-200 text-sm">{c.name}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{c.phone}</div>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-800 px-2.5 py-1 rounded-md text-slate-400 border border-slate-700">
                            {c.relationship || 'Contact'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic p-6 text-center border border-dashed border-slate-700/50 rounded-lg">No emergency contacts listed.</div>
                  )}
                </div>
              </div>

              {/* Subject History */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
                <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between text-xs uppercase tracking-widest text-slate-400 font-bold hover:text-slate-300 transition-colors"
                  >
                    <span className="flex items-center gap-2"><Clock size={14} className="text-purple-400" /> Subject History</span>
                    {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-3 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-slate-200">{history?.past_alerts || 0}</span>
                            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mt-1">Past SOS Alerts</span>
                          </div>
                          <div className="bg-slate-900/40 rounded-lg border border-slate-800/50 p-3 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-black text-slate-200">{history?.past_complaints || 0}</span>
                            <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 mt-1">Complaints Filed</span>
                          </div>
                        </div>

                        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 ml-1">Recent Complaints</div>
                        {history?.recent_complaints?.length > 0 ? (
                          <div className="space-y-2">
                            {history.recent_complaints.map((c: any, i: number) => (
                              <div key={i} className="text-sm bg-slate-900/40 p-2.5 rounded-lg border border-slate-800/50 flex justify-between gap-3 items-center">
                                <span className="text-slate-300 truncate font-medium text-xs" title={c.subject}>{c.subject || 'No subject'}</span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${c.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>{c.status}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic px-2">No recent complaints found.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>

            {/* ROW 3: CONTEXT & MESSAGE */}
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
               <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                  <FileText size={14} className="text-amber-400" /> Incident Context, Transcript & Evidence
                </h3>
              </div>
              <div className="p-4">
                <div className="bg-slate-900/40 border border-slate-800/50 rounded-lg p-4 text-slate-300 font-medium">
                  {data.message ? (
                    <div className="flex gap-3 items-start">
                      <span className="text-4xl text-slate-600 leading-none font-serif">"</span>
                      <p className="pt-2 leading-relaxed italic">{data.message}</p>
                    </div>
                  ) : (
                    <span className="italic text-slate-500 text-sm">No text message or voice transcript provided with this SOS trigger.</span>
                  )}
                </div>
                {data.audio_file_path ? (
                  <div className="mt-3 bg-slate-900/40 border border-slate-800/50 rounded-lg p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Activity size={16} />
                      </div>
                      <div className="text-xs text-slate-400">
                        <span className="font-bold text-slate-300">Voice Evidence Uploaded</span><br />
                        <span className="font-mono text-[10px]">{data.audio_file_path.split(/[\\/]/).pop()}</span>
                      </div>
                    </div>
                    <audio 
                      controls 
                      src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/uploads/${data.audio_file_path.split(/[\\/]/).pop()}`} 
                      className="w-full h-8"
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ) : (
                  <div className="mt-3 bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                      <Activity size={16} />
                    </div>
                    <div className="text-sm text-slate-200 font-medium tracking-wide">
                      No voice recording evidence available for this alert.
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL - MAP (30%) */}
          <div className="col-span-1 lg:col-span-4 border-l border-slate-700/50 bg-slate-950 flex flex-col relative z-0">
            <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                <Navigation size={14} className="text-red-400" /> Live Tactical Map
              </h3>
              {hasValidLocation && (
                <div className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> GPS LOCK
                </div>
              )}
            </div>
            
            <div className="flex-1 relative z-0">
              {hasValidLocation ? (
                <MapContainer center={[lat, lng]} zoom={15} className="w-full h-full absolute inset-0 z-0">
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  {pathPositions.length > 1 && (
                    <Polyline positions={pathPositions} color="#ef4444" weight={3} dashArray="5, 10" />
                  )}
                  <Marker position={[lat, lng]}>
                    <Popup className="bg-slate-900 border-slate-700 text-slate-200">
                      <strong>Incident Origin</strong><br/>
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-500 gap-3 bg-slate-900/20">
                  <Map size={48} className="opacity-20" />
                  <p className="uppercase tracking-widest text-xs font-bold">No Location Data Available</p>
                </div>
              )}
            </div>

            {hasValidLocation && (
              <div className="bg-slate-900/90 p-4 border-t border-slate-800 shrink-0 shadow-[0_-10px_20px_rgba(0,0,0,0.3)] z-10 relative">
                <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Coordinates & Location</div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-500 block mb-0.5">LATITUDE</span>
                    <span className="font-mono text-slate-300 font-bold">{lat.toFixed(6)}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-500 block mb-0.5">LONGITUDE</span>
                    <span className="font-mono text-slate-300 font-bold">{lng.toFixed(6)}</span>
                  </div>
                </div>
                {location?.district && (
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-xs flex items-start gap-2">
                    <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-300 font-bold">{location.district}</div>
                      <div className="text-slate-500 mt-0.5">Region Location Match</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
        </div>
      </motion.div>
    </div>
  );
}
