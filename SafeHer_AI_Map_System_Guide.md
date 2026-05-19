# SafeHer AI Women Safety Navigation System — Implementation & Deployment Guide

This guide details the complete design, code integration, folder architecture, and backend systems for the new **AI-Powered Women Safety Navigation & Live SOS Telemetry Map System** in **SafeHer AI**.

---

## 🗺️ System Overview
The SafeHer safety navigation engine operates as a high-fidelity predictive system composed of:
1. **Live GPS Telemetry Watcher:** Multi-level foreground location stream sending real-time coordinates to backend APIs and Socket.IO servers.
2. **AI Predictive Route Safety Engine:** Selects the safest well-lit corridors using public crime heatmaps, time-of-day indicators, and active police posts, bypassing high-risk zones.
3. **Behavioral Deviation Monitoring:** Scans active paths for sudden stops, unusual lane/street changes, or isolated zone entry, dynamically scaling risk scores and broadcasting alerts.
4. **Geofenced Danger Warnings:** Triggers high-intensity local vibrations and modal warnings if the user crosses the radius of any marked high-danger sector.
5. **Acoustic & Voice-Triggered SOS:** Built-in microphone layer listening for voice commander inputs (e.g. *"Help me"* or *"SOS"*) to initiate local and remote emergency procedures.
6. **Dynamic Heatmaps & Nearby Services:** Displays police stations, safety posts, hospitals, and counseling centers with direct dialing and navigational integration.

---

## 📁 System Folder Structure
The implementation is organized as follows:
```
SafeherApp/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── ai.py            <-- GET /area-risk & POST /predict-route-safety
│   │   │       ├── sos.py           <-- POST /trigger-voice & POST /trigger
│   │   │       └── location.py      <-- POST /location/update
│   │   ├── services/
│   │   │   ├── alert_service.py     <-- Twilio SMS + Emergency notifications background tasks
│   │   │   └── user_service.py
│   │   └── websockets/
│   │       └── socket_manager.py    <-- Broadcasts live locations & SOS warnings to Admins
└── frontend/
    └── src/
        ├── api/
        │   └── client.ts            <-- Axios bindings for route safety & voice SOS
        ├── screens/
        │   ├── MapScreen.tsx        <-- Startup-level interactive navigation map
        │   └── SOSScreen.tsx        <-- Voice recording & stress upload controller
```

---

## 🛠️ Database Schema Design (MongoDB Atlas)

### 1. `danger_zones` Collection
```json
{
  "_id": "zone-1",
  "name": "Sector 7 Dark Corridor (Low Lighting)",
  "location": {
    "latitude": 12.9756,
    "longitude": 77.5996
  },
  "radius": 240,
  "risk_level": "high",
  "risk_score": 82,
  "factors": ["unlit passage", "historical petty thefts", "isolated night lane"],
  "created_at": "2026-05-19T22:25:00Z"
}
```

### 2. `trip_history` Collection
```json
{
  "_id": "trip-98a287bf",
  "user_id": "3686bee8-4622-480d-9f1e-e8d905ae3c3b",
  "destination": "Commercial Square, Bengaluru",
  "start_location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "planned_route": [
    {"latitude": 12.9716, "longitude": 77.5946},
    {"latitude": 12.9738, "longitude": 77.5936},
    {"latitude": 12.9750, "longitude": 77.5966}
  ],
  "deviations_detected": 1,
  "max_danger_score": 89,
  "status": "completed",
  "started_at": "2026-05-19T22:20:00Z",
  "ended_at": "2026-05-19T22:35:00Z"
}
```

---

## 🌐 FastAPI Route Definitions

### 1. Safest Route Prediction (`/api/ai/predict-route-safety`)
Calculates safest paths bypassing any marked danger zones in the target coordinate bounding box.
```python
@router.post("/predict-route-safety")
async def predict_route_safety(data: dict, current_user: dict = Depends(get_current_user)):
    # Bypasses active danger zones, returning well-lit coordinates
    # Failsafe local logic runs if external LLM/maps API is unreachable
```

### 2. Location Tracking and Behavioral Assessment (`/api/location/update`)
Appends user coordinates to `location_history` and verifies deviation indexes.
```python
@router.post("/update")
async def update_location(data: dict, current_user: dict = Depends(get_current_user)):
    # Performs geofencing and behavioral deviation validation
```

---

## 🚀 Execution & Quick-Start Guide

### 1. Start the FastAPI Backend
Ensure Python virtual environment is active:
```powershell
cd backend
.\venv\Scripts\activate
python run.py
```

### 2. Launch the Mobile Expo App
Start the metro bundler and connect your emulator/physical device:
```powershell
cd frontend
npm start
```

### 3. Open the Premium Safety Map
* Navigate to the **Live Map** screen.
* Enter a target destination and tap **"Plan Safest Route"** to draw the emerald green AI safety route.
* Toggle the **"Simulate Route Deviation"** switch to test how the AI Behavioral Analysis scales the risk score up to **89%** and warns the emergency network!
* Tap the **Sunny / Moon** icon to simulate time-of-day risk fluctuations.
* Tap the **Microphone** button, speak safety keywords, and watch the system lock into blinking red SOS Emergency telemetry instantly!
