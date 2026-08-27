import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Circle, InfoWindow, HeatmapLayer } from '@react-google-maps/api';
import { adminAPI } from './api';
import { useSocket } from './SocketContext';
import { 
  Shield, AlertTriangle, Crosshair, Map as MapIcon, 
  Layers, Users, Info, Settings, Navigation
} from 'lucide-react';

const mapContainerStyle = { width: '100%', height: '100%' };
const center = { lat: 10.126, lng: 101.100 }; // Default center
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

const libraries: any = ['visualization'];

export default function MapPage() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""),
    libraries
  });

  const { socket } = useSocket();
  const [liveUsers, setLiveUsers] = useState<any>({});
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [map, setMap] = useState<any>(null);

  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showUsers, setShowUsers] = useState(true);
  const [mapType, setMapType] = useState<'tactical' | 'satellite'>('tactical');

  const fetchLiveState = useCallback(async () => {
    try {
      const [usersRes, alertsRes] = await Promise.all([
        adminAPI.getLiveUsers(),
        adminAPI.getActiveAlerts()
      ]);
      const usersMap = {};
      usersRes.data.live_users?.forEach((u: any) => { usersMap[u.user_id] = u; });
      setLiveUsers(usersMap);
      setActiveAlerts(alertsRes.data || []);
    } catch (e) {
      console.error("Failed to fetch live map state", e);
    }
  }, []);

  useEffect(() => {
    fetchLiveState();
    if (!socket) return;

    socket.on('user_location_update', (data: any) => {
      setLiveUsers((prev: any) => ({ ...prev, [data.user_id]: data }));
    });

    socket.on('new_sos_alert', (data: any) => {
      setActiveAlerts((prev) => [...prev, data]);
      // Auto-center on new alert
      if (map && data.location) {
        map.panTo({ lat: data.location.latitude, lng: data.location.longitude });
      }
    });

    return () => {
      socket.off('user_location_update');
      socket.off('new_sos_alert');
    };
  }, [socket, fetchLiveState, map]);

  const onMapLoad = useCallback((map: any) => setMap(map), []);

  const handleGlobalView = () => {
    if (!map || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    
    Object.values(liveUsers).forEach((u: any) => {
      if (u.latitude && u.longitude) {
        bounds.extend(new window.google.maps.LatLng(u.latitude, u.longitude));
        hasPoints = true;
      }
    });
    activeAlerts.forEach((a: any) => {
      if (a.location?.latitude && a.location?.longitude) {
        bounds.extend(new window.google.maps.LatLng(a.location.latitude, a.location.longitude));
        hasPoints = true;
      }
    });
    
    if (hasPoints) {
      map.fitBounds(bounds);
    } else {
      map.setZoom(6);
      map.panTo(center);
    }
  };

  const toggleHeatmap = () => setShowHeatmap(!showHeatmap);
  const toggleUsers = () => setShowUsers(!showUsers);
  const toggleSettings = () => setMapType(mapType === 'tactical' ? 'satellite' : 'tactical');

  if (!isLoaded) return <div style={{ color: '#8b5cf6', padding: 20 }}>Loading Tactical Grid...</div>;

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Map Control Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button className="map-tool-btn" title="Global View" onClick={handleGlobalView}><MapIcon size={20} /></button>
          <button className="map-tool-btn" title="Live Heatmap" onClick={toggleHeatmap} style={{ color: showHeatmap ? '#ef4444' : '' }}><Layers size={20} /></button>
          <button className="map-tool-btn" title="User Tracking" onClick={toggleUsers} style={{ color: showUsers ? '#06b6d4' : '' }}><Users size={20} /></button>
          <div style={{ height: '1px', background: 'var(--border)' }} />
          <button className="map-tool-btn" title="Toggle Satellite View" onClick={toggleSettings} style={{ color: mapType === 'satellite' ? '#10b981' : '' }}><Settings size={20} /></button>
        </div>
      </div>

      {/* Info Sidebar */}
      <div style={{ position: 'absolute', top: 20, right: 20, bottom: 20, zIndex: 10, width: '320px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Active Alert Panel */}
        <div className="glass-card neon-border" style={{ padding: '20px', background: 'rgba(239,68,68,0.1)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
             <AlertTriangle size={18} className="pulse" /> LIVE EMERGENCY FEED
          </h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeAlerts.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>No active alerts in monitored sector.</p>
            ) : (
              activeAlerts.map(a => (
                <div key={a.id} style={{ padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }} onClick={() => map.panTo({ lat: a.location.latitude, lng: a.location.longitude })}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{a.user_name || 'Anonymous'}</span>
                    <span style={{ fontSize: '10px', color: '#ef4444' }}>{a.severity.toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>Triggered via {a.trigger_type}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tactical Intel Panel */}
        <div className="glass-card" style={{ flex: 1, padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
             <Shield size={18} /> SECTOR INTELLIGENCE
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={s.intelItem}>
              <span style={s.intelLabel}>Monitored Users</span>
              <span style={s.intelValue}>{Object.keys(liveUsers).length}</span>
            </div>
            <div style={s.intelItem}>
              <span style={s.intelLabel}>Sector Risk</span>
              <span style={{ ...s.intelValue, color: '#10b981' }}>LOW</span>
            </div>
            <div style={s.intelItem}>
              <span style={s.intelLabel}>Nearest Unit</span>
              <span style={s.intelValue}>0.8 KM</span>
            </div>
            <div style={{ height: '1px', background: 'var(--border)', margin: '8px 0' }} />
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>SYSTEM OVERVIEW</p>
              <p style={{ fontSize: '12px', marginTop: '4px', lineHeight: 1.4 }}>
                All emergency systems operational. Satellite lock confirmed for current sector.
              </p>
            </div>
          </div>
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          styles: mapType === 'tactical' ? tacticalStyle : undefined,
          mapTypeId: mapType === 'satellite' ? 'hybrid' : 'roadmap',
          disableDefaultUI: true,
          zoomControl: false,
          mapTypeControl: false,
        }}
      >
        {/* Heatmap Layer */}
        {showHeatmap && window.google && (
          <HeatmapLayer
            data={activeAlerts.map((a: any) => new window.google.maps.LatLng(a.location.latitude, a.location.longitude))}
            options={{ radius: 40, opacity: 0.8, gradient: ['rgba(0, 255, 255, 0)', 'rgba(0, 255, 255, 1)', 'rgba(0, 191, 255, 1)', 'rgba(0, 127, 255, 1)', 'rgba(0, 63, 255, 1)', 'rgba(0, 0, 255, 1)', 'rgba(0, 0, 223, 1)', 'rgba(0, 0, 191, 1)', 'rgba(0, 0, 159, 1)', 'rgba(0, 0, 127, 1)', 'rgba(63, 0, 91, 1)', 'rgba(127, 0, 63, 1)', 'rgba(191, 0, 31, 1)', 'rgba(255, 0, 0, 1)'] }}
          />
        )}

        {/* User Markers */}
        {showUsers && Object.values(liveUsers).map((user: any) => (
          <React.Fragment key={user.user_id}>
            <Marker
              position={{ lat: user.latitude, lng: user.longitude }}
              icon={{
                path: window.google ? google.maps.SymbolPath.CIRCLE : 0,
                fillColor: '#8b5cf6',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 7,
              }}
              onClick={() => setSelectedItem(user)}
            />
            {/* Visual Tracking Pulse */}
            <Circle
              center={{ lat: user.latitude, lng: user.longitude }}
              radius={300}
              options={{
                fillColor: '#8b5cf6',
                fillOpacity: 0.1,
                strokeColor: '#8b5cf6',
                strokeOpacity: 0.2,
                strokeWeight: 1,
              }}
            />
          </React.Fragment>
        ))}

        {/* SOS Alert Markers */}
        {activeAlerts.map((alert) => (
          <React.Fragment key={alert.id}>
             <Marker
                position={{ lat: alert.location.latitude, lng: alert.location.longitude }}
                icon={{
                  path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                  scale: 1.5,
                  anchor: window.google ? new google.maps.Point(12, 12) : undefined,
                }}
                onClick={() => setSelectedItem(alert)}
             />
             {/* Alert Danger Zone Circle */}
             <Circle
                center={{ lat: alert.location.latitude, lng: alert.location.longitude }}
                radius={500}
                options={{
                  fillColor: '#ef4444',
                  fillOpacity: 0.15,
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.5,
                  strokeWeight: 2,
                }}
             />
             {/* Radar Pulse Effect */}
             <Circle
                center={{ lat: alert.location.latitude, lng: alert.location.longitude }}
                radius={1200}
                options={{
                  fillColor: '#ef4444',
                  fillOpacity: 0.05,
                  strokeColor: '#ef4444',
                  strokeOpacity: 0.2,
                  strokeWeight: 1,
                  clickable: false
                }}
             />
          </React.Fragment>
        ))}

        {selectedItem && (
          <InfoWindow
            position={{ 
              lat: selectedItem.latitude || selectedItem.location?.latitude, 
              lng: selectedItem.longitude || selectedItem.location?.longitude 
            }}
            onCloseClick={() => setSelectedItem(null)}
          >
            <div style={{ color: '#000', minWidth: '150px' }}>
              <h4 style={{ margin: 0 }}>{selectedItem.user_name || 'Active Monitor'}</h4>
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                Status: {selectedItem.severity ? 'EMERGENCY' : 'Tracking'}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

const s = {
  toolBtn: { 
    width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', 
    border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', display: 'flex', 
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' 
  },
  intelItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  intelLabel: { fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' },
  intelValue: { fontSize: '14px', fontWeight: 800, color: '#f8f4ff' },
};
