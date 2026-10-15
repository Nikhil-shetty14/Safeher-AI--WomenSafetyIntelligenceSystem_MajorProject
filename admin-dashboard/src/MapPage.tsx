import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  Circle, 
  InfoWindow, 
  HeatmapLayer, 
  TrafficLayer, 
  Polyline 
} from '@react-google-maps/api';
import { adminAPI } from './api';
import { useSocket } from './SocketContext';
import AlertIntelligencePanel from './components/AlertIntelligencePanel';
import { 
  Shield, AlertTriangle, Crosshair, Map as MapIcon, 
  Layers, Users, Settings, Navigation, Volume2, VolumeX, 
  Compass, Search, Phone, Mail, CheckCircle2, X, 
  RotateCw, Radio, Sparkles, ChevronRight, Activity, 
  MapPin, Eye, EyeOff, ShieldAlert, ShieldCheck, Flame, 
  Car, Building2, Maximize2, Minimize2, Copy, Check, Info,
  Smartphone, UserCheck
} from 'lucide-react';

const mapContainerStyle = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bengaluru Command Sector

// Tactical Cyber Dark Mode
const tacticalStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#120c2b" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#706a8a" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#120c2b" }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#2a1f4a" }] },
  { "featureType": "administrative.country", "elementType": "geometry.stroke", "stylers": [{ "color": "#4b3a8a" }] },
  { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#120c2b" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#1e1540" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#706a8a" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e1540" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#2a1f4a" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2a1f4a" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#8b5cf6" }, { "weight": 0.5 }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#1e1540" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#06040d" }] }
];

// Stealth Dark Monochrome Mode
const stealthStyle = [
  { elementType: "geometry", stylers: [{ color: "#181820" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#181820" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#383848" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#252535" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a9a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#323245" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c0c14" }] }
];

const libraries: any = ['visualization'];

// Verified Sector Emergency Safe Havens & Police Posts
const SECTOR_SAFE_HAVENS = [
  {
    id: 'sh-1',
    name: 'Bengaluru Central Police Station',
    type: 'police',
    latitude: 12.9774,
    longitude: 77.5929,
    phone: '112 / 080-22942222',
    address: 'Kasturba Road, Near Cubbon Park',
    status: '24/7 Command Precinct',
    officer: 'Insp. R. Venkatesh'
  },
  {
    id: 'sh-2',
    name: 'Women Police Station - Halasuru Gate',
    type: 'police',
    latitude: 12.9680,
    longitude: 77.5870,
    phone: '1091 / 080-22942542',
    address: 'Police Corner, Nrupathunga Road',
    status: '24/7 Rapid Women Response Cell',
    officer: 'Sub-Insp. Kavitha M.'
  },
  {
    id: 'sh-3',
    name: 'Victoria Emergency Trauma & Hospital',
    type: 'hospital',
    latitude: 12.9635,
    longitude: 77.5746,
    phone: '108 / 080-26701150',
    address: 'Fort Road, Near City Market',
    status: 'Level-1 Emergency Trauma Center',
    officer: 'Emergency Triage Desk'
  },
  {
    id: 'sh-4',
    name: 'Cubbon Park Safe Corridor Hub',
    type: 'safe_haven',
    latitude: 12.9738,
    longitude: 77.5960,
    phone: '1091',
    address: "Queen's Road Gate, Cubbon Park",
    status: 'Illuminated 24/7 Safe Haven',
    officer: 'Patrol Officer D. Kumar'
  },
  {
    id: 'sh-5',
    name: 'Indiranagar Police Station',
    type: 'police',
    latitude: 12.9719,
    longitude: 77.6412,
    phone: '112 / 080-22942525',
    address: '100 Feet Road, Indiranagar',
    status: '24/7 Rapid Response Unit',
    officer: 'Insp. Anand Rao'
  }
];

export default function MapPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""),
    libraries
  });

  const { socket } = useSocket();
  
  // Real Database & Live Stream State
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [liveLocations, setLiveLocations] = useState<{ [uid: string]: any }>({});
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [historicalHeatmap, setHistoricalHeatmap] = useState<any[]>([]);
  const [userTrails, setUserTrails] = useState<{ [uid: string]: { lat: number; lng: number }[] }>({});
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedAlertForIntel, setSelectedAlertForIntel] = useState<string | null>(null);
  const [map, setMap] = useState<any>(null);

  // Active flyout panel state: 'map' | 'layers' | 'users' | 'settings' | null
  const [activePanel, setActivePanel] = useState<'map' | 'layers' | 'users' | 'settings' | null>(null);

  // Layer Toggles
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapRadius, setHeatmapRadius] = useState(38);
  const [showTraffic, setShowTraffic] = useState(false);
  const [showSafeHavens, setShowSafeHavens] = useState(true);
  const [showPerimeters, setShowPerimeters] = useState(true);
  const [showEmergencyMarkers, setShowEmergencyMarkers] = useState(true);

  // User Tracking Toggles
  const [showUsers, setShowUsers] = useState(true);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'live' | 'sos' | 'standby'>('all');

  // Settings & Display Toggles
  const [mapTheme, setMapTheme] = useState<'tactical' | 'satellite' | 'stealth' | 'roadmap'>('tactical');
  const [autoPanSOS, setAutoPanSOS] = useState(true);
  const [autoSound, setAutoSound] = useState(true);
  const [showRadarPulses, setShowRadarPulses] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [mapTilt, setMapTilt] = useState(0);

  // Synthesize tactical emergency audio chime
  const playTacticalChime = useCallback(() => {
    if (!autoSound) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy handled silently
    }
  }, [autoSound]);

  // Fetch real users, live telemetry and active alerts from backend
  const fetchLiveState = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const [usersRes, liveRes, alertsRes] = await Promise.all([
        adminAPI.getUsers(0, 100).catch(() => ({ data: [] })),
        adminAPI.getLiveUsers().catch(() => ({ data: { live_users: [] } })),
        adminAPI.getActiveAlerts().catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(usersRes.data)) {
        setRegisteredUsers(usersRes.data);
      }

      const liveMap: any = {};
      liveRes.data?.live_users?.forEach((u: any) => { 
        if (u.latitude && u.longitude) {
          liveMap[u.user_id] = u; 
        }
      });
      setLiveLocations(liveMap);

      if (Array.isArray(alertsRes.data)) {
        setActiveAlerts(alertsRes.data);
      }
    } catch (e) {
      console.error("Failed to fetch live map state", e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch real heatmap data from backend (historical incidents)
  const fetchHeatmapData = useCallback(async () => {
    try {
      const res = await adminAPI.getHeatmap();
      if (Array.isArray(res.data)) {
        setHistoricalHeatmap(res.data);
      }
    } catch (e) {
      console.warn("Could not fetch historical heatmap", e);
    }
  }, []);

  useEffect(() => {
    fetchLiveState();
    fetchHeatmapData();
    const interval = setInterval(fetchLiveState, 15000);
    return () => clearInterval(interval);
  }, [fetchLiveState, fetchHeatmapData]);

  // Real-time WebSockets listeners for live telemetry
  useEffect(() => {
    if (!socket) return;

    socket.on('user_location_update', (data: any) => {
      if (!data || !data.user_id) return;
      setLiveLocations((prev: any) => ({ ...prev, [data.user_id]: data }));

      if (data.latitude && data.longitude) {
        setUserTrails((prev) => {
          const existing = prev[data.user_id] || [];
          return {
            ...prev,
            [data.user_id]: [...existing.slice(-25), { lat: data.latitude, lng: data.longitude }]
          };
        });
      }
    });

    socket.on('sos_location_update', (data: any) => {
      if (!data || !data.user_id) return;
      setLiveLocations((prev: any) => ({ ...prev, [data.user_id]: data }));
    });

    socket.on('new_sos_alert', (data: any) => {
      setActiveAlerts((prev) => [data, ...prev.filter(a => a.id !== data.id)]);
      playTacticalChime();

      if (autoPanSOS && map && data.location?.latitude && data.location?.longitude) {
        map.panTo({ lat: data.location.latitude, lng: data.location.longitude });
        map.setZoom(16);
      }
    });

    return () => {
      socket.off('user_location_update');
      socket.off('sos_location_update');
      socket.off('new_sos_alert');
    };
  }, [socket, map, autoPanSOS, playTacticalChime]);

  const onMapLoad = useCallback((loadedMap: any) => {
    setMap(loadedMap);
  }, []);

  // PROPER REAL USERS DIRECTORY: Merges registered DB users + live streaming locations + SOS alerts
  const properUsersList = useMemo(() => {
    const list: any[] = [];
    const seenUserIds = new Set<string>();

    // 1. Registered Users from DB
    registeredUsers.forEach((ru: any) => {
      const uid = ru.id || ru._id;
      if (!uid) return;
      seenUserIds.add(uid);

      const liveLoc = liveLocations[uid];
      const alert = activeAlerts.find(a => (a.user_id === uid || a.id === uid));

      const isSOS = !!alert;
      const isLive = !!liveLoc && typeof liveLoc.latitude === 'number' && typeof liveLoc.longitude === 'number';

      const lat = liveLoc?.latitude || alert?.location?.latitude;
      const lng = liveLoc?.longitude || alert?.location?.longitude;
      const hasCoords = typeof lat === 'number' && typeof lng === 'number';

      list.push({
        user_id: uid,
        user_name: ru.name || liveLoc?.user_name || 'Registered Citizen',
        email: ru.email || '—',
        phone: ru.phone || alert?.user_phone || '—',
        role: ru.role || 'user',
        division: ru.division || alert?.location?.division || 'Bengaluru Command Sector',
        district: ru.district || alert?.location?.district || 'Bengaluru Urban',
        status: isSOS ? 'emergency' : isLive ? 'active' : 'standby',
        latitude: lat,
        longitude: lng,
        has_coords: hasCoords,
        speed: liveLoc?.speed || 0,
        battery: liveLoc?.battery,
        formatted_address: liveLoc?.formatted_address || alert?.location?.address || `${ru.district || 'Bengaluru Urban'}, ${ru.division || 'Karnataka'}`,
        last_updated: liveLoc?.timestamp || alert?.created_at || ru.created_at,
        is_registered: true,
        alert_info: alert || null,
      });
    });

    // 2. Active Alert Users (in case not in registered users list)
    activeAlerts.forEach((a: any) => {
      const uid = a.user_id || a.id;
      if (uid && !seenUserIds.has(uid)) {
        seenUserIds.add(uid);
        const liveLoc = liveLocations[uid];
        const lat = liveLoc?.latitude || a.location?.latitude;
        const lng = liveLoc?.longitude || a.location?.longitude;
        const hasCoords = typeof lat === 'number' && typeof lng === 'number';

        list.push({
          user_id: uid,
          user_name: a.user_name || liveLoc?.user_name || 'Emergency Caller',
          email: '—',
          phone: a.user_phone || '—',
          role: 'user',
          division: a.location?.division || 'Bengaluru Command Sector',
          district: a.location?.district || 'Bengaluru Urban',
          status: 'emergency',
          latitude: lat,
          longitude: lng,
          has_coords: hasCoords,
          speed: liveLoc?.speed || 0,
          battery: liveLoc?.battery,
          formatted_address: a.location?.address || 'Active SOS Site',
          last_updated: a.created_at,
          is_registered: false,
          alert_info: a,
        });
      }
    });

    // 3. Live Streaming Users (in case not in registered users list)
    Object.values(liveLocations).forEach((loc: any) => {
      const uid = loc.user_id;
      if (uid && !seenUserIds.has(uid)) {
        seenUserIds.add(uid);
        const lat = loc.latitude;
        const lng = loc.longitude;
        const hasCoords = typeof lat === 'number' && typeof lng === 'number';

        list.push({
          user_id: uid,
          user_name: loc.user_name || 'Active Mobile Citizen',
          email: '—',
          phone: loc.phone || '—',
          role: 'user',
          division: 'Bengaluru Command Sector',
          district: 'Bengaluru Urban',
          status: 'active',
          latitude: lat,
          longitude: lng,
          has_coords: hasCoords,
          speed: loc.speed || 0,
          battery: loc.battery,
          formatted_address: loc.formatted_address || 'Live GPS Sector',
          last_updated: loc.timestamp,
          is_registered: false,
          alert_info: null,
        });
      }
    });

    return list;
  }, [registeredUsers, liveLocations, activeAlerts]);

  // Filtered users for search & tabs
  const filteredUsers = useMemo(() => {
    return properUsersList.filter((u: any) => {
      const q = userSearchQuery.toLowerCase();
      const matchesSearch = 
        (u.user_name || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.district || '').toLowerCase().includes(q) ||
        (u.division || '').toLowerCase().includes(q) ||
        (u.formatted_address || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (userFilterTab === 'live') return u.status === 'active';
      if (userFilterTab === 'sos') return u.status === 'emergency';
      if (userFilterTab === 'standby') return u.status === 'standby';
      return true;
    });
  }, [properUsersList, userSearchQuery, userFilterTab]);

  const liveUsersWithCoords = useMemo(() => {
    return properUsersList.filter(u => u.has_coords);
  }, [properUsersList]);

  // Compute Heatmap Points safely
  const heatmapPoints = useMemo(() => {
    if (!window.google) return [];
    const points: any[] = [];

    // Historical backend incidents
    historicalHeatmap.forEach((h) => {
      if (h.lat && h.lng) {
        points.push({
          location: new window.google.maps.LatLng(h.lat, h.lng),
          weight: h.severity === 'critical' ? 3 : h.severity === 'high' ? 2 : 1
        });
      }
    });

    // Active live distress alerts
    activeAlerts.forEach((a) => {
      const lat = a.location?.latitude || a.lat;
      const lng = a.location?.longitude || a.lng;
      if (lat && lng) {
        points.push({
          location: new window.google.maps.LatLng(lat, lng),
          weight: a.severity === 'critical' ? 4 : 2
        });
      }
    });

    return points;
  }, [historicalHeatmap, activeAlerts]);

  // SMART GLOBAL FIT BOUNDS
  const handleFitAllBounds = () => {
    if (!map || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    liveUsersWithCoords.forEach((u: any) => {
      bounds.extend(new window.google.maps.LatLng(u.latitude, u.longitude));
      hasPoints = true;
    });

    activeAlerts.forEach((a: any) => {
      const lat = a.location?.latitude || a.lat;
      const lng = a.location?.longitude || a.lng;
      if (lat && lng) {
        bounds.extend(new window.google.maps.LatLng(lat, lng));
        hasPoints = true;
      }
    });

    if (showSafeHavens) {
      SECTOR_SAFE_HAVENS.forEach((sh) => {
        bounds.extend(new window.google.maps.LatLng(sh.latitude, sh.longitude));
        hasPoints = true;
      });
    }

    if (hasPoints) {
      map.fitBounds(bounds);
    } else {
      map.setZoom(13);
      map.panTo(DEFAULT_CENTER);
    }
  };

  // FOCUS ACTIVE EMERGENCY
  const handleFocusEmergency = () => {
    if (!map) return;
    const criticalAlert = activeAlerts.find(a => a.severity === 'critical') || activeAlerts[0];
    if (criticalAlert && criticalAlert.location) {
      map.panTo({ lat: criticalAlert.location.latitude, lng: criticalAlert.location.longitude });
      map.setZoom(16);
      setSelectedItem(criticalAlert);
    } else {
      handleFitAllBounds();
    }
  };

  // RECENTER ON HEADQUARTERS
  const handleRecenterHQ = () => {
    if (!map) return;
    map.panTo(DEFAULT_CENTER);
    map.setZoom(14);
  };

  // MY LIVE GPS
  const handleLocateMe = () => {
    if (!navigator.geolocation || !map) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.panTo(userPos);
        map.setZoom(15);
      },
      () => {
        handleRecenterHQ();
      }
    );
  };

  // TOGGLE TILT
  const handleToggleTilt = () => {
    if (!map) return;
    const newTilt = mapTilt === 0 ? 45 : 0;
    setMapTilt(newTilt);
    if (typeof map.setTilt === 'function') {
      map.setTilt(newTilt);
    }
  };

  // Resolve Alert handler
  const handleResolveAlert = async (id: string) => {
    try {
      await adminAPI.resolveAlert(id);
      setActiveAlerts(prev => prev.filter(a => a.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
      if (selectedAlertForIntel === id) setSelectedAlertForIntel(null);
    } catch {
      alert("Failed to resolve emergency alert.");
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0818', color: '#a78bfa', flexDirection: 'column', gap: 12 }}>
        <Radio className="spin" size={32} color="#8b5cf6" />
        <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '0.05em' }}>CONNECTING TO SATELLITE COMMAND GRID...</span>
      </div>
    );
  }

  const liveCount = properUsersList.filter(u => u.status === 'active').length;
  const emergencyCount = properUsersList.filter(u => u.status === 'emergency').length;
  const standbyCount = properUsersList.filter(u => u.status === 'standby').length;

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
      
      {/* FLOATING TACTICAL TOOLBAR (Matching user's dock) */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="glass-card" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '14px', borderRadius: '18px', background: 'rgba(15, 11, 35, 0.88)', border: '1px solid rgba(139, 92, 246, 0.28)' }}>
          
          {/* Button 1: Map / Perspective */}
          <button 
            className={`map-tool-btn ${activePanel === 'map' ? 'active-map' : ''}`}
            title="Map Perspectives & View"
            onClick={() => setActivePanel(activePanel === 'map' ? null : 'map')}
          >
            <MapIcon size={20} />
          </button>

          {/* Button 2: Layers */}
          <button 
            className={`map-tool-btn ${activePanel === 'layers' || showHeatmap || showTraffic ? 'active-layers' : ''}`}
            title="Tactical GIS Layers"
            onClick={() => setActivePanel(activePanel === 'layers' ? null : 'layers')}
            style={{ color: showHeatmap || showTraffic || activePanel === 'layers' ? '#fbbf24' : '' }}
          >
            <Layers size={20} />
          </button>

          {/* Button 3: Users (Live Tracking) */}
          <button 
            className={`map-tool-btn ${showUsers || activePanel === 'users' ? 'active-users' : ''}`}
            title="Registered & Live Personnel"
            onClick={() => setActivePanel(activePanel === 'users' ? null : 'users')}
            style={{ color: showUsers ? '#06b6d4' : '' }}
          >
            <Users size={20} />
          </button>

          {/* Thin Divider */}
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.12)', margin: '2px 4px' }} />

          {/* Button 4: Settings */}
          <button 
            className={`map-tool-btn ${activePanel === 'settings' ? 'active-settings' : ''}`}
            title="Tactical Grid Settings"
            onClick={() => setActivePanel(activePanel === 'settings' ? null : 'settings')}
            style={{ color: activePanel === 'settings' ? '#34d399' : '' }}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FLYOUT 1: MAP PERSPECTIVES & RECENTER                     */}
      {/* ======================================================== */}
      {activePanel === 'map' && (
        <div className="glass-card tactical-flyout" style={{ ...s.flyoutPanel, left: 74, width: '310px' }}>
          <div style={s.flyoutHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...s.iconPill, background: 'rgba(167, 139, 250, 0.2)', color: '#c084fc' }}>
                <MapIcon size={16} />
              </div>
              <div>
                <h4 style={s.flyoutTitle}>Map Perspectives</h4>
                <p style={s.flyoutSub}>Sector Camera Control</p>
              </div>
            </div>
            <button style={s.closeBtn} onClick={() => setActivePanel(null)}><X size={15} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <button style={s.actionBtn} onClick={handleFitAllBounds}>
              <Crosshair size={16} color="#c084fc" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Fit All Telemetry</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Include all active units & alerts</div>
              </div>
            </button>

            <button 
              style={{ ...s.actionBtn, opacity: activeAlerts.length > 0 ? 1 : 0.6 }} 
              onClick={handleFocusEmergency}
            >
              <AlertTriangle size={16} color="#ef4444" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#ef4444' }}>Focus Emergency</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {activeAlerts.length > 0 ? `${activeAlerts.length} Active SOS in sector` : 'No active alerts in sector'}
                </div>
              </div>
            </button>

            <button style={s.actionBtn} onClick={handleRecenterHQ}>
              <Navigation size={16} color="#06b6d4" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Recenter Command HQ</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Bengaluru Central Sector Base</div>
              </div>
            </button>

            <button style={s.actionBtn} onClick={handleLocateMe}>
              <Compass size={16} color="#10b981" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>My Live GPS Position</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Locate current dispatcher device</div>
              </div>
            </button>

            <button style={s.actionBtn} onClick={handleToggleTilt}>
              <RotateCw size={16} color="#f59e0b" />
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>Perspective Tilt (3D)</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{mapTilt === 45 ? '45° 3D Tactical Pitch Active' : 'Flat 2D Nadir View'}</div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: mapTilt === 45 ? '#f59e0b' : '#94a3b8' }}>
                {mapTilt === 45 ? '3D' : '2D'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FLYOUT 2: TACTICAL GIS LAYERS                             */}
      {/* ======================================================== */}
      {activePanel === 'layers' && (
        <div className="glass-card tactical-flyout" style={{ ...s.flyoutPanel, left: 74, width: '320px' }}>
          <div style={s.flyoutHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...s.iconPill, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                <Layers size={16} />
              </div>
              <div>
                <h4 style={s.flyoutTitle}>Tactical GIS Layers</h4>
                <p style={s.flyoutSub}>Overlays & Environmental Intel</p>
              </div>
            </div>
            <button style={s.closeBtn} onClick={() => setActivePanel(null)}><X size={15} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            
            {/* 1. Incident Danger Heatmap */}
            <div style={s.layerCard}>
              <div style={s.layerRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flame size={18} color="#ef4444" />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Danger Heatmap</span>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      {heatmapPoints.length} incident records mapped
                    </p>
                  </div>
                </div>
                <div 
                  className={`tactical-toggle ${showHeatmap ? 'on' : ''}`}
                  onClick={() => setShowHeatmap(!showHeatmap)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>

              {showHeatmap && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: 4 }}>
                    <span>Density Blur Radius</span>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>{heatmapRadius}px</span>
                  </div>
                  <input 
                    type="range" 
                    min={18} 
                    max={65} 
                    value={heatmapRadius} 
                    onChange={(e) => setHeatmapRadius(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#fbbf24', cursor: 'pointer' }}
                  />
                </div>
              )}
            </div>

            {/* 2. Live Road Traffic */}
            <div style={s.layerCard}>
              <div style={s.layerRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Car size={18} color="#10b981" />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Live Traffic Congestion</span>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      Real-time road flow overlay
                    </p>
                  </div>
                </div>
                <div 
                  className={`tactical-toggle ${showTraffic ? 'on' : ''}`}
                  onClick={() => setShowTraffic(!showTraffic)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>
            </div>

            {/* 3. Safe Havens & Police Posts */}
            <div style={s.layerCard}>
              <div style={s.layerRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} color="#06b6d4" />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Safe Havens & Police</span>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      {SECTOR_SAFE_HAVENS.length} Verified safe havens
                    </p>
                  </div>
                </div>
                <div 
                  className={`tactical-toggle ${showSafeHavens ? 'on' : ''}`}
                  onClick={() => setShowSafeHavens(!showSafeHavens)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>
            </div>

            {/* 4. Hazard Danger Perimeters */}
            <div style={s.layerCard}>
              <div style={s.layerRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={18} color="#ef4444" />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Emergency Danger Radii</span>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      500m Hazard & 1200m Radar Zone
                    </p>
                  </div>
                </div>
                <div 
                  className={`tactical-toggle ${showPerimeters ? 'on' : ''}`}
                  onClick={() => setShowPerimeters(!showPerimeters)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FLYOUT 3: PROPER REGISTERED & LIVE PERSONNEL             */}
      {/* ======================================================== */}
      {activePanel === 'users' && (
        <div className="glass-card tactical-flyout" style={{ ...s.flyoutPanel, left: 74, width: '350px' }}>
          <div style={s.flyoutHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...s.iconPill, background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4' }}>
                <Users size={16} />
              </div>
              <div>
                <h4 style={s.flyoutTitle}>Personnel & Citizen Fleet</h4>
                <p style={s.flyoutSub}>
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', marginRight: 5 }} />
                  {properUsersList.length} Total Registered
                </p>
              </div>
            </div>
            <button style={s.closeBtn} onClick={() => setActivePanel(null)}><X size={15} /></button>
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>LIVE GPS</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#06b6d4' }}>{liveCount}</div>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>IN DISTRESS</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#ef4444' }}>{emergencyCount}</div>
            </div>
            <div style={{ padding: '6px 8px', borderRadius: 8, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>STANDBY</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#e2e8f0' }}>{standbyCount}</div>
            </div>
          </div>

          {/* Master Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Show User Pins on Map</span>
              <div 
                className={`tactical-toggle ${showUsers ? 'on' : ''}`}
                onClick={() => setShowUsers(!showUsers)}
              >
                <div className="tactical-toggle-thumb" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Real-time Breadcrumb Trails</span>
              <div 
                className={`tactical-toggle ${showBreadcrumbs ? 'on' : ''}`}
                onClick={() => setShowBreadcrumbs(!showBreadcrumbs)}
              >
                <div className="tactical-toggle-thumb" />
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ marginTop: 10, position: 'relative' }}>
            <Search size={14} color="#64748b" style={{ position: 'absolute', top: 10, left: 10 }} />
            <input 
              type="text" 
              placeholder="Filter by name, phone, or district..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              style={s.searchInput}
            />
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {[
              { id: 'all', label: `All (${properUsersList.length})` },
              { id: 'live', label: `Live (${liveCount})` },
              { id: 'sos', label: `SOS (${emergencyCount})` },
              { id: 'standby', label: `Standby (${standbyCount})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setUserFilterTab(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '5px 4px',
                  borderRadius: 6,
                  border: userFilterTab === tab.id ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.06)',
                  background: userFilterTab === tab.id ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255,255,255,0.02)',
                  color: userFilterTab === tab.id ? '#06b6d4' : '#94a3b8',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Proper Users Roster List */}
          <div style={{ maxHeight: '270px', overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '12px' }}>
                <Radio className="spin" size={18} style={{ margin: '0 auto 8px' }} color="#06b6d4" />
                Querying database personnel registry...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 10px', color: '#64748b', fontSize: '12px' }}>
                No registered citizens match current criteria.
              </div>
            ) : (
              filteredUsers.map((u: any) => {
                const isSOS = u.status === 'emergency';
                const isLive = u.status === 'active';
                return (
                  <div 
                    key={u.user_id}
                    style={{
                      ...s.userCard,
                      border: isSOS 
                        ? '1px solid rgba(239, 68, 68, 0.45)' 
                        : isLive 
                        ? '1px solid rgba(6, 182, 212, 0.45)' 
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      background: isSOS 
                        ? 'rgba(239, 68, 68, 0.08)' 
                        : isLive 
                        ? 'rgba(6, 182, 212, 0.06)' 
                        : 'rgba(0, 0, 0, 0.25)'
                    }}
                    onClick={() => {
                      if (u.has_coords && map) {
                        map.panTo({ lat: u.latitude, lng: u.longitude });
                        map.setZoom(17);
                      }
                      setSelectedItem(u);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ 
                          width: 30, height: 30, borderRadius: '50%', 
                          background: isSOS ? 'rgba(239, 68, 68, 0.25)' : isLive ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${isSOS ? '#ef4444' : isLive ? '#06b6d4' : '#64748b'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '12px', color: '#fff'
                        }}>
                          {u.user_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px', color: '#f8fafc' }}>
                            {u.user_name}
                          </div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={10} color="#64748b" />
                            {u.phone}
                          </div>
                        </div>
                      </div>

                      <span style={{ 
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: isSOS ? 'rgba(239, 68, 68, 0.25)' : isLive ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        color: isSOS ? '#ef4444' : isLive ? '#06b6d4' : '#94a3b8'
                      }}>
                        {isSOS ? 'DISTRESS SOS' : isLive ? 'LIVE GPS' : 'STANDBY'}
                      </span>
                    </div>

                    <div style={{ marginTop: 6, fontSize: '11px', color: '#cbd5e1' }}>
                      <span style={{ color: '#64748b' }}>Jurisdiction: </span>
                      {u.district || 'Bengaluru Urban'}, {u.division || 'Karnataka'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '10px' }}>
                      {u.has_coords ? (
                        <>
                          <span style={{ color: '#94a3b8' }}>
                            Speed: <strong style={{ color: '#f1f5f9' }}>{u.speed || 0} km/h</strong>
                          </span>
                          <span style={{ color: '#06b6d4', fontWeight: 700, cursor: 'pointer' }}>
                            Focus Camera ›
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#64748b' }}>GPS Idle (Awaiting Mobile App)</span>
                          <span style={{ color: '#a78bfa', fontWeight: 600, cursor: 'pointer' }}>
                            View Dossier ›
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* FLYOUT 4: TACTICAL CONSOLE SETTINGS                       */}
      {/* ======================================================== */}
      {activePanel === 'settings' && (
        <div className="glass-card tactical-flyout" style={{ ...s.flyoutPanel, left: 74, width: '320px' }}>
          <div style={s.flyoutHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...s.iconPill, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                <Settings size={16} />
              </div>
              <div>
                <h4 style={s.flyoutTitle}>Tactical Grid Settings</h4>
                <p style={s.flyoutSub}>Map Engine & Automation</p>
              </div>
            </div>
            <button style={s.closeBtn} onClick={() => setActivePanel(null)}><X size={15} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            
            {/* Base Map Theme */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                Map Base Theme
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                {[
                  { id: 'tactical', label: 'Tactical Cyber' },
                  { id: 'satellite', label: 'Satellite Hybrid' },
                  { id: 'stealth', label: 'Stealth Dark' },
                  { id: 'roadmap', label: 'Civilian Street' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMapTheme(t.id as any)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: mapTheme === t.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                      background: mapTheme === t.id ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                      color: mapTheme === t.id ? '#34d399' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Automation Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Auto-Pan to Incoming SOS</span>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Focus camera on emergency</p>
                </div>
                <div 
                  className={`tactical-toggle ${autoPanSOS ? 'on' : ''}`}
                  onClick={() => setAutoPanSOS(!autoPanSOS)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Emergency Audio Chime</span>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Play sound on distress signal</p>
                </div>
                <div 
                  className={`tactical-toggle ${autoSound ? 'on' : ''}`}
                  onClick={() => setAutoSound(!autoSound)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Radar Scan Animations</span>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Pulsing rings around emergencies</p>
                </div>
                <div 
                  className={`tactical-toggle ${showRadarPulses ? 'on' : ''}`}
                  onClick={() => setShowRadarPulses(!showRadarPulses)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Right Intelligence Sidebar</span>
                  <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Toggle sector intel sidebar</p>
                </div>
                <div 
                  className={`tactical-toggle ${showSidebar ? 'on' : ''}`}
                  onClick={() => setShowSidebar(!showSidebar)}
                >
                  <div className="tactical-toggle-thumb" />
                </div>
              </div>
            </div>

            {/* Force Sync button */}
            <div style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button 
                style={{ ...s.actionBtn, justifyContent: 'center', width: '100%' }}
                onClick={() => {
                  fetchLiveState();
                  fetchHeatmapData();
                  alert("Telemetry & registered users re-synced from database.");
                }}
              >
                <RotateCw size={14} color="#10b981" />
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Force Resync Database Telemetry</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* RIGHT-HAND SECTOR INTELLIGENCE SIDEBAR                   */}
      {/* ======================================================== */}
      {showSidebar && (
        <div style={{ position: 'absolute', top: 20, right: 20, bottom: 20, zIndex: 10, width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Active Alert Panel */}
          <div className="glass-card neon-border" style={{ padding: '18px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
               <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <AlertTriangle size={16} className="pulse" /> LIVE EMERGENCY FEED
               </span>
               <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 999 }}>
                 {activeAlerts.length} ACTIVE
               </span>
            </h3>

            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeAlerts.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '10px 0', textAlign: 'center' }}>
                  No active emergencies in monitored sector.
                </p>
              ) : (
                activeAlerts.map(a => (
                  <div 
                    key={a.id} 
                    style={{ padding: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
                    onClick={() => {
                      if (map && a.location) {
                        map.panTo({ lat: a.location.latitude, lng: a.location.longitude });
                        map.setZoom(16);
                      }
                      setSelectedItem(a);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: '#f8fafc' }}>{a.user_name || 'Anonymous User'}</span>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                        {(a.severity || 'CRITICAL').toUpperCase()}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                      Trigger: {a.trigger_type || 'Panic Button'}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '10px', color: '#cbd5e1' }}>
                      <span>Sector: {a.location?.division || 'Bengaluru'}</span>
                      <span style={{ color: '#c084fc', textDecoration: 'underline' }}>View Intel ›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tactical Sector Intel Card */}
          <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
               <Shield size={16} /> SECTOR TELEMETRY INTEL
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
              <div style={s.intelItem}>
                <span style={s.intelLabel}>Registered Citizens</span>
                <span style={s.intelValue}>{properUsersList.length}</span>
              </div>
              <div style={s.intelItem}>
                <span style={s.intelLabel}>Live GPS Streaming</span>
                <span style={{ ...s.intelValue, color: '#06b6d4' }}>{liveCount} Active</span>
              </div>
              <div style={s.intelItem}>
                <span style={s.intelLabel}>Sector Risk Index</span>
                <span style={{ ...s.intelValue, color: activeAlerts.length > 0 ? '#ef4444' : '#10b981' }}>
                  {activeAlerts.length > 0 ? 'ELEVATED' : 'NOMINAL (LOW)'}
                </span>
              </div>
              <div style={s.intelItem}>
                <span style={s.intelLabel}>Verified Safe Havens</span>
                <span style={s.intelValue}>{SECTOR_SAFE_HAVENS.length} Units</span>
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, margin: '0 0 4px 0' }}>COMMUNICATION STATUS</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4, margin: 0 }}>
                  Live database synchronization connected. Real WebSocket streaming active for field units and dispatchers.
                </p>
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button 
                  style={{ ...s.actionBtn, width: '100%', justifyContent: 'center' }}
                  onClick={handleFitAllBounds}
                >
                  <Crosshair size={14} color="#a78bfa" />
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Reset Sector Viewport</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* GOOGLE MAP CANVAS                                         */}
      {/* ======================================================== */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={DEFAULT_CENTER}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          styles: mapTheme === 'tactical' ? tacticalStyle : mapTheme === 'stealth' ? stealthStyle : undefined,
          mapTypeId: mapTheme === 'satellite' ? 'hybrid' : 'roadmap',
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
        }}
      >
        {/* Live Traffic Congestion Layer */}
        {showTraffic && <TrafficLayer />}

        {/* Historical + Active Distress Heatmap Layer */}
        {showHeatmap && window.google && heatmapPoints.length > 0 && (
          <HeatmapLayer
            data={heatmapPoints}
            options={{
              radius: heatmapRadius,
              opacity: 0.85,
              gradient: [
                'rgba(0, 255, 255, 0)',
                'rgba(0, 255, 255, 1)',
                'rgba(0, 191, 255, 1)',
                'rgba(0, 127, 255, 1)',
                'rgba(0, 63, 255, 1)',
                'rgba(0, 0, 255, 1)',
                'rgba(0, 0, 223, 1)',
                'rgba(0, 0, 191, 1)',
                'rgba(0, 0, 159, 1)',
                'rgba(0, 0, 127, 1)',
                'rgba(63, 0, 91, 1)',
                'rgba(127, 0, 63, 1)',
                'rgba(191, 0, 31, 1)',
                'rgba(255, 0, 0, 1)'
              ]
            }}
          />
        )}

        {/* User Movement Breadcrumbs / Trails */}
        {showBreadcrumbs && showUsers && Object.entries(userTrails).map(([uid, trail]) => (
          trail.length > 1 ? (
            <Polyline
              key={`trail-${uid}`}
              path={trail}
              options={{
                strokeColor: '#06b6d4',
                strokeOpacity: 0.75,
                strokeWeight: 3,
                geodesic: true,
              }}
            />
          ) : null
        ))}

        {/* Real Live Users with Active GPS Markers */}
        {showUsers && liveUsersWithCoords.map((user: any) => {
          const isSOS = user.status === 'emergency';
          return (
            <React.Fragment key={user.user_id}>
              <Marker
                position={{ lat: user.latitude, lng: user.longitude }}
                icon={{
                  path: window.google ? google.maps.SymbolPath.CIRCLE : 0,
                  fillColor: isSOS ? '#ef4444' : '#06b6d4',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: isSOS ? 9 : 7,
                }}
                onClick={() => setSelectedItem(user)}
              />
              {/* Telemetry tracking halo */}
              <Circle
                center={{ lat: user.latitude, lng: user.longitude }}
                radius={isSOS ? 400 : 200}
                options={{
                  fillColor: isSOS ? '#ef4444' : '#06b6d4',
                  fillOpacity: isSOS ? 0.2 : 0.12,
                  strokeColor: isSOS ? '#ef4444' : '#06b6d4',
                  strokeOpacity: 0.35,
                  strokeWeight: 1,
                  clickable: false,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Verified Safe Havens & Police Stations */}
        {showSafeHavens && SECTOR_SAFE_HAVENS.map((sh) => (
          <Marker
            key={sh.id}
            position={{ lat: sh.latitude, lng: sh.longitude }}
            icon={{
              path: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
              fillColor: sh.type === 'police' ? '#2563eb' : sh.type === 'hospital' ? '#dc2626' : '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5,
              scale: 1.2,
              anchor: window.google ? new google.maps.Point(12, 12) : undefined,
            }}
            onClick={() => setSelectedItem({ ...sh, isSafeHaven: true })}
          />
        ))}

        {/* SOS Emergency Alert Markers & Hazard Perimeters */}
        {showEmergencyMarkers && activeAlerts.map((alert) => {
          const lat = alert.location?.latitude || alert.lat;
          const lng = alert.location?.longitude || alert.lng;
          if (!lat || !lng) return null;

          return (
            <React.Fragment key={alert.id}>
              <Marker
                position={{ lat, lng }}
                icon={{
                  path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                  scale: 1.6,
                  anchor: window.google ? new google.maps.Point(12, 12) : undefined,
                }}
                onClick={() => setSelectedItem(alert)}
              />

              {/* 500m Hazard Danger Zone */}
              {showPerimeters && (
                <Circle
                  center={{ lat, lng }}
                  radius={500}
                  options={{
                    fillColor: '#ef4444',
                    fillOpacity: 0.16,
                    strokeColor: '#ef4444',
                    strokeOpacity: 0.5,
                    strokeWeight: 2,
                    clickable: false
                  }}
                />
              )}

              {/* 1200m Tactical Radar Perimeter */}
              {showPerimeters && showRadarPulses && (
                <Circle
                  center={{ lat, lng }}
                  radius={1200}
                  options={{
                    fillColor: '#ef4444',
                    fillOpacity: 0.04,
                    strokeColor: '#ef4444',
                    strokeOpacity: 0.25,
                    strokeWeight: 1,
                    clickable: false
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* RICH TACTICAL INFOWINDOW */}
        {selectedItem && (
          <InfoWindow
            position={{ 
              lat: selectedItem.latitude || selectedItem.location?.latitude || selectedItem.lat || DEFAULT_CENTER.lat, 
              lng: selectedItem.longitude || selectedItem.location?.longitude || selectedItem.lng || DEFAULT_CENTER.lng 
            }}
            onCloseClick={() => setSelectedItem(null)}
          >
            <div style={{ color: '#0f172a', minWidth: '240px', maxWidth: '300px', padding: '4px' }}>
              
              {/* Case 1: Safe Haven / Police */}
              {selectedItem.isSafeHaven ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ShieldCheck size={16} color="#2563eb" />
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{selectedItem.name}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: 6 }}>
                    {selectedItem.address}
                  </div>
                  <div style={{ fontSize: '11px', background: '#eff6ff', padding: '6px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                    <div><strong>Helpline:</strong> <a href={`tel:${selectedItem.phone.split('/')[0].trim()}`} style={{ color: '#1d4ed8' }}>{selectedItem.phone}</a></div>
                    <div><strong>Status:</strong> {selectedItem.status}</div>
                    <div><strong>Officer:</strong> {selectedItem.officer}</div>
                  </div>
                </div>
              ) : selectedItem.severity || selectedItem.trigger_type ? (
                /* Case 2: SOS Emergency Alert */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={15} /> EMERGENCY SOS
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 4 }}>
                      {(selectedItem.severity || 'CRITICAL').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{selectedItem.user_name || 'Anonymous User'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>
                    Triggered via: <strong>{selectedItem.trigger_type || 'Panic Button'}</strong>
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: 8 }}>
                    Coordinates: {(selectedItem.location?.latitude || selectedItem.lat)?.toFixed(4)}, {(selectedItem.location?.longitude || selectedItem.lng)?.toFixed(4)}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button 
                      style={{ flex: 1, padding: '6px', borderRadius: 6, background: '#8b5cf6', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setSelectedAlertForIntel(selectedItem.id)}
                    >
                      AI Intelligence
                    </button>
                    <button 
                      style={{ padding: '6px 10px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => handleResolveAlert(selectedItem.id)}
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              ) : (
                /* Case 3: Real Proper User */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ 
                        width: 8, height: 8, borderRadius: '50%', 
                        background: selectedItem.status === 'emergency' ? '#ef4444' : selectedItem.status === 'active' ? '#06b6d4' : '#64748b' 
                      }} />
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{selectedItem.user_name || 'Registered Citizen'}</span>
                    </div>
                    <span style={{ 
                      fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                      background: selectedItem.status === 'emergency' ? '#fee2e2' : selectedItem.status === 'active' ? '#e0f2fe' : '#f1f5f9',
                      color: selectedItem.status === 'emergency' ? '#dc2626' : selectedItem.status === 'active' ? '#0284c7' : '#64748b'
                    }}>
                      {selectedItem.status === 'emergency' ? 'SOS DISTRESS' : selectedItem.status === 'active' ? 'LIVE GPS' : 'REGISTERED'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 6 }}>
                    {selectedItem.formatted_address || `${selectedItem.district || 'Bengaluru Urban'}, ${selectedItem.division || 'Karnataka'}`}
                  </div>

                  <div style={{ fontSize: '11px', background: '#f8fafc', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div><strong>Phone:</strong> <a href={`tel:${selectedItem.phone}`} style={{ color: '#0284c7', textDecoration: 'none' }}>{selectedItem.phone || '—'}</a></div>
                    <div><strong>Email:</strong> {selectedItem.email || '—'}</div>
                    <div><strong>Jurisdiction:</strong> {selectedItem.district || 'Bengaluru Urban'}, {selectedItem.division || 'Karnataka'}</div>
                    {selectedItem.has_coords && (
                      <div><strong>Telemetry:</strong> {selectedItem.speed || 0} km/h • GPS Active</div>
                    )}
                  </div>

                  {selectedItem.phone && selectedItem.phone !== '—' && (
                    <div style={{ marginTop: 8 }}>
                      <a 
                        href={`tel:${selectedItem.phone}`}
                        style={{ 
                          display: 'block', textAlign: 'center', padding: '6px', 
                          borderRadius: 6, background: '#0284c7', color: '#fff', 
                          fontSize: '11px', fontWeight: 600, textDecoration: 'none' 
                        }}
                      >
                        Call Citizen ({selectedItem.phone})
                      </a>
                    </div>
                  )}
                </div>
              )}

            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* AI Intelligence Panel Modal */}
      {selectedAlertForIntel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '92%', maxWidth: '1100px', height: '88vh', background: '#0f0b24', borderRadius: '18px', border: '1px solid #8b5cf6', overflow: 'hidden', position: 'relative' }}>
            <AlertIntelligencePanel 
              alertId={selectedAlertForIntel} 
              onClose={() => setSelectedAlertForIntel(null)} 
              onResolve={(id) => handleResolveAlert(id)} 
            />
          </div>
        </div>
      )}

    </div>
  );
}

const s: { [key: string]: React.CSSProperties } = {
  flyoutPanel: {
    position: 'absolute',
    top: 20,
    zIndex: 25,
    padding: '16px',
    borderRadius: '16px',
    background: 'rgba(15, 11, 35, 0.94)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(139, 92, 246, 0.28)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
    color: '#fff',
  },
  flyoutHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  flyoutTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
  },
  flyoutSub: {
    fontSize: '11px',
    color: '#94a3b8',
    margin: 0,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#f1f5f9',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  layerCard: {
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  layerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 32px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  userCard: {
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  intelItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  intelLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  intelValue: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#f8fafc',
  },
};
