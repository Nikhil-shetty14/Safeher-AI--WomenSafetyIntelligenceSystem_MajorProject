# SafeHer AI — Women Safety Intelligence System
## Complete Project Technical Architecture, Algorithms & Implementation Document

---

## 1. Project Overview & Problem Statement

### 1.1 Problem Statement
Women's personal safety in urban and suburban environments remains a pressing global challenge. Conventional emergency applications suffer from key operational deficiencies:
* **High-Friction Triggering:** Requiring victims to unlock phones, navigate UIs, or dial emergency numbers during an attack or imminent threat.
* **Absence of Contextual Threat Intelligence:** Existing apps cannot automatically interpret audio panic, acoustic screaming, or subtle verbal distress signals.
* **Blind Routing:** Standard GPS navigation routes users through the shortest path regardless of lighting conditions, historical crime hotspots, or active distress alerts.
* **Fragmented Emergency Dispatch:** Lack of unified, real-time telemetry streaming to family members and jurisdictional police command authorities simultaneously.

### 1.2 Solution: SafeHer AI
**SafeHer AI** is an end-to-end, multi-tiered AI and IoT-enabled Women Safety Intelligence Platform. It couples a cross-platform mobile client (React Native / Expo) with a high-throughput asynchronous backend (FastAPI / Motor / MongoDB Atlas), a state-wide Tactical Command Center (React.js / Vite / TailwindCSS / Socket.IO), and on-device/local AI intelligence engines (Ollama Phi-3 / OpenAI Whisper / Librosa Acoustic Signal Processing).

---

## 2. Core Objectives

* **Zero/Low-Friction SOS Activation:** Instant emergency triggering via high-gravity physical device shakes ($> 3G$), continuous acoustic voice triggers ("Help me", "Save me", screams), or one-touch emergency UI triggers.
* **Dual-Layer Threat Detection Engine:** Concurrent execution of acoustic feature extraction (pitch, RMS energy, ZCR, MFCCs) and NLP deep threat classification (Ollama / Phi-3 Mini) with automatic SOS escalation.
* **Safety-Weighted A\* Predictive Navigation:** Real-time pathfinding across a dynamically weighted geographic coordinate grid, routing users around dynamic danger zones and active distress hotspots.
* **Autonomous Live Walk Watch (SafeTimer):** Automated check-in monitoring with cross-track route deviation tracking and automatic countdown escalation.
* **Decentralized Multi-Tier Police Dispatch:** Automated geospatial mapping to jurisdictional divisions and districts (e.g., Karnataka's 4 Revenue Divisions and 31 Districts) with live WebSocket telemetry.
* **Multi-Channel Contact Dispatch:** Instant automated Twilio Programmable SMS containing live Google Maps pinpoint links and automated TwiML Voice calls.

---

## 3. Technology Stack & System Components

### 3.1 Mobile Frontend (React Native & Expo)
* **Core Framework:** React Native 0.74+, Expo SDK 51, TypeScript.
* **Navigation:** React Navigation (Stack & Bottom Tabs).
* **Hardware Sensors & Media:** `expo-sensors` (3-axis Accelerometer for Shake Detection), `expo-av` (WAV Audio Recording & Playback), `expo-location` (High-accuracy GPS Telemetry & Background Geofencing).
* **Networking & Real-time:** Axios HTTP Client, Socket.IO Client for bidirectional live GPS streaming.
* **State Management:** React Context API (Auth Context, Emergency State, Socket Provider).

### 3.2 Web Admin & State Command Dashboard
* **Core Framework:** React 18, Vite, TypeScript.
* **Styling & UI:** TailwindCSS, Lucide React Icons, Glassmorphism design system.
* **Mapping & GIS:** Leaflet / OpenStreetMap / Mapbox with real-time heatmap overlays, pulsing SOS markers, and division boundary filters.
* **Real-time Engine:** Socket.IO Client with dedicated dispatcher audio siren alerts.

### 3.3 Backend Server & Microservices
* **Framework:** Python 3.10+, FastAPI (Asynchronous ASGI).
* **Server:** Uvicorn ASGI worker engine.
* **Database & ODM:** MongoDB Atlas (NoSQL) accessed via Motor (Async Python Driver) with GeoJSON `2dsphere` spatial indexing.
* **Real-time WebSockets:** Python-SocketIO (Async ASGI Socket Manager).
* **Security & Auth:** OAuth2 Password Bearer, JWT (JSON Web Tokens with HS256 algorithm), Passlib with Bcrypt password hashing.

### 3.4 Artificial Intelligence & Signal Processing Engines
* **Large Language Model (NLP):** Local LLM via Ollama (`phi3:mini` / `llama3`) running locally or cloud fallback for structured JSON danger classification.
* **Speech-to-Text (STT):** OpenAI Whisper (`base` model) running via PyTorch with lazy loading.
* **Acoustic Audio Analysis:** Librosa & NumPy for pitch tracking (`piptrack`), RMS energy extraction, Zero Crossing Rate (`ZCR`), and Mel-Frequency Cepstral Coefficients (`MFCC`).
* **Live GIS Overpass Engine:** OpenStreetMap Overpass API for real-time live discovery of nearby police stations, hospitals, and pharmacies.

### 3.5 External Cloud Services & Telephony
* **Telephony & Dispatch:** Twilio REST API (Programmable SMS) & Twilio Voice (TwiML Text-to-Speech).
* **Geospatial & Mapping:** Google Maps Directions API & Google Polyline Decoding algorithm.

---

## 4. Complete System Architecture

```
                                +-------------------------------------------------------+
                                |               SafeHer Mobile App (React Native)       |
                                |  - 3-Axis Shake Sensor   - Microphone (expo-av)       |
                                |  - Live GPS Telemetry    - Offline SOS Fallback       |
                                +---------------------------+---------------------------+
                                                            |
                                        HTTP POST / WebSockets (Socket.IO)
                                                            |
                                                            v
+-------------------------------------------------------------------------------------------------------------------+
|                                             FastAPI Asynchronous Gateway Layer                                    |
|                                                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +-------------+  |
|  |   Auth & Security  |  |    SOS & Alerts    |  |  AI Intelligence   |  | Location & Telemetry| | Admin / Gov |  |
|  |     (/api/auth)    |  |     (/api/sos)     |  |     (/api/ai)      |  |   (/api/location)  |  |(/api/admin) |  |
|  +--------------------+  +--------------------+  +--------------------+  +--------------------+  +-------------+  |
+-----------------------------------------------------------+-------------------------------------------------------+
                                                            |
         +--------------------------------------------------+--------------------------------------------------+
         |                                                  |                                                  |
         v                                                  v                                                  v
+------------------------+              +-----------------------------------------+              +----------------------------+
|  AI Processing Pipeline|              |           Data & Storage Layer          |              |  Real-time Socket.IO Hub   |
| - Whisper (STT)        |              | - MongoDB Atlas (Motor Async Driver)    |              | - Live GPS Broadcaster     |
| - Librosa (Acoustics)  |              |   * Users, Contacts, SOS Alerts         |              | - Incident Dispatch Room   |
| - Ollama (Phi-3 Mini)  |              |   * DangerZones, Complaints, Trips      |              | - Police State Dashboard   |
| - Grid A* Pathfinding  |              | - Location History (2dsphere spatial)   |              +--------------+-------------+
+-----------+------------+              +-----------------------------------------+                             |
            |                                               |                                                   v
            v                                               v                                    +----------------------------+
+------------------------+              +-----------------------------------------+              |  State Police Command Ctr  |
| Telephony Dispatch Svc |              |         External Geospatial APIs        |              |  (React + Tailwind + OSM)  |
| - Twilio SMS Pinpoint  |              | - Google Maps Directions & Polyline API |              | - Live Radar & Siren       |
| - Twilio TwiML Voice   |              | - OpenStreetMap Overpass Live API       |              | - 4 Revenue Divisions View |
+------------------------+              +-----------------------------------------+              +----------------------------+
```

---

## 5. Mathematical & Algorithmic Formulations

### 5.1 Algorithm 1: Safety-Weighted Grid A\* Pathfinding
* **Module:** `backend/app/utils/pathfinding.py` (`GridAStar` and `calculate_safe_route`)
* **Purpose:** Calculates the safest walking trajectory between coordinates by dynamically penalizing grid cells intersecting with active danger zones and high-crime hotspots.

```
       [Start Node]
            │
            ▼ (8-Directional Grid Search)
      [  .   .   .  ]
      [  . (DANGER) . ]  <-- Dynamic Penalty applied: weight = 1.0 + (1 - d/r)*(score/10)
      [  .   .   .  ]
            │
            ▼ (A* chooses safety-weighted path around danger zone)
       [Safe Path] ────────► [Destination Node]
```

#### Mathematical Formulation:
1. **Bounding Box Generation:**
   $$\text{lat}_{\min} = \min(\text{start}_{\text{lat}}, \text{end}_{\text{lat}}) - 0.2 \cdot \Delta_{\text{lat}}, \quad \text{lat}_{\max} = \max(\text{start}_{\text{lat}}, \text{end}_{\text{lat}}) + 0.2 \cdot \Delta_{\text{lat}}$$
   $$\text{lng}_{\min} = \min(\text{start}_{\text{lng}}, \text{end}_{\text{lng}}) - 0.2 \cdot \Delta_{\text{lng}}, \quad \text{lng}_{\max} = \max(\text{start}_{\text{lng}}, \text{end}_{\text{lng}}) + 0.2 \cdot \Delta_{\text{lng}}$$
2. **Grid Discretization:** The bounding box is divided into a $25 \times 25$ node matrix. Each node $(x,y)$ represents geographic coordinates $(\text{lat}_{x,y}, \text{lng}_{x,y})$.
3. **Danger Zone Penalty Weighting:**
   For every node $n$ and every danger zone $z = (\text{lat}_z, \text{lng}_z, r_z, s_z)$:
   $$\text{distance}(n, z) = \text{Haversine}(\text{lat}_n, \text{lng}_n, \text{lat}_z, \text{lng}_z)$$
   $$\text{If } \text{distance}(n, z) < r_z: \quad \text{penalty}(n, z) = \left(1 - \frac{\text{distance}(n,z)}{r_z}\right) \times \left(\frac{s_z}{10.0}\right)$$
   $$\text{danger\_weight}(n) = 1.0 + \max_{z} \text{penalty}(n, z)$$
4. **Cost Evaluation Function:**
   $$f(n) = g(n) + h(n)$$
   $$g(\text{neighbor}) = g(\text{current}) + \left(\text{Haversine}(\text{current}, \text{neighbor}) \times \text{danger\_weight}(\text{neighbor})\right)$$
   $$h(n) = \text{Haversine}(n, \text{end})$$
5. **Node Exploration:** Utilizes 8-directional neighbor transitions: $\{(-1,0), (1,0), (0,-1), (0,1), (-1,-1), (-1,1), (1,-1), (1,1)\}$ with a min-priority heap `heapq`.

* **Time Complexity:** $O((V + E) \log V)$ where $V = 676$ nodes ($26 \times 26$ grid), $E \le 8V$. Executed in $< 5\text{ms}$.
* **Space Complexity:** $O(V)$ for open priority queue and closed set.

---

### 5.2 Algorithm 2: Haversine Great-Circle Distance Metric
* **Module:** `backend/app/utils/geo_mapping.py`, `backend/app/services/ai_service.py`
* **Purpose:** Calculates exact spherical distances over the Earth's surface for geofencing, route deviation checks, and nearest emergency service ranking.

$$\Delta\phi = \text{radians}(\text{lat}_2 - \text{lat}_1), \quad \Delta\lambda = \text{radians}(\text{lon}_2 - \text{lon}_1)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\text{radians}(\text{lat}_1)) \cdot \cos(\text{radians}(\text{lat}_2)) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \arctan2\left(\sqrt{a}, \sqrt{1-a}\right)$$
$$d = R \cdot c \quad (\text{where Earth radius } R = 6371.0\text{ km})$$

* **Time Complexity:** $O(1)$ constant time.
* **Space Complexity:** $O(1)$.

---

### 5.3 Algorithm 3: Acoustic Signal Processing & Voice Stress Analysis
* **Module:** `backend/app/ai/voice_analyzer.py`
* **Input:** Raw audio recording (`.wav` or multi-format converted via `pydub`).
* **Processing Steps:**
  1. **Resampling:** Downsampled to $16\text{ kHz}$ mono PCM audio ($y$, sample rate $sr = 16000$).
  2. **Pitch Extraction (Piptrack):**
     $$\text{pitches}, \text{magnitudes} = \text{librosa.piptrack}(y=y, sr=sr)$$
     $$F_0 = \text{mean}(\text{pitches}[\text{pitches} > 0])$$
  3. **RMS Energy (Volume & Screaming Intensity):**
     $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=1}^N |y(n)|^2}$$
  4. **Zero Crossing Rate (Speech Agitation & Rapid Breathing):**
     $$\text{ZCR} = \frac{1}{2(N-1)} \sum_{n=1}^{N-1} |\text{sgn}(y[n]) - \text{sgn}(y[n-1])|$$
  5. **13-Band Mel-Frequency Cepstral Coefficients (MFCC):** Extracts spectral envelope and timbre representations.
  6. **Multi-Feature Decision Classifier:**
     $$\text{stress\_score} = \begin{cases} 
     0.90 & \text{if } F_0 > 250\text{ Hz} \text{ and } \text{RMS} > 0.05 \quad (\text{Fear / Screaming}) \\
     0.80 & \text{if } \text{RMS} > 0.08 \quad (\text{Aggression / Violent Noise}) \\
     0.75 & \text{if } \text{ZCR} > 0.20 \quad (\text{Rapid Panic Speech}) \\
     0.20 & \text{if } \text{RMS} < 0.005 \quad (\text{Muffled / Whispering}) \\
     0.40 & \text{otherwise} \quad (\text{Agitated / Elevated})
     \end{cases}$$
     $$\text{If } \text{stress\_score} > 0.75 \implies \text{trigger\_emergency} = \text{True}$$

---

### 5.4 Algorithm 4: Natural Language Threat Extraction & LLM JSON Schema Enforcement
* **Module:** `backend/app/ai/llm_engine.py`
* **Engine:** Local Ollama running `phi3:mini` (quantized 3.8B parameter model).
* **Mechanism:**
  * Strict temperature control ($T = 0.2$) for deterministic safety assessment.
  * System prompt instructs the model to act as a Tactical Emergency Intelligence Engine.
  * Forced JSON schema generation (`format="json"`) parsed with Python `json.loads()` and verified against Pydantic models.
  * Outputs 4 discrete danger tiers:
    * `LOW` (Suspicious cues $\to$ silent contact logging).
    * `MEDIUM` (Unsafe environment $\to$ safety confirmation push notification).
    * `HIGH` (Stalking, physical threat $\to$ automated SMS dispatch).
    * `CRITICAL` (Immediate assault/violence $\to$ Twilio voice call + Police dispatch).

---

### 5.5 Algorithm 5: Nearest Centroid Jurisdictional Police Dispatching
* **Module:** `backend/app/utils/geo_mapping.py`
* **Purpose:** Maps live coordinate streams to the exact Karnataka Revenue Division and District police headquarters.
* **Mapping Mechanism:**
  1. Computes Haversine distance between emergency coordinates $(\text{lat}_{\text{SOS}}, \text{lng}_{\text{SOS}})$ and 31 District administrative centroids.
  2. Identifies $D^* = \arg\min_{D} \text{Haversine}(\text{Coord}_{\text{SOS}}, \text{Centroid}_D)$.
  3. Maps $D^*$ to one of the 4 Administrative Revenue Divisions:
     * **Bangalore Division:** Bengaluru Urban, Bengaluru Rural, Ramanagara, Chikkaballapura, Tumakuru, Kolar, Chitradurga, Davanagere, Shivamogga.
     * **Mysuru Division:** Mysuru, Chamarajanagar, Mandya, Hassan, Chikkamagaluru, Kodagu, Udupi, Dakshina Kannada.
     * **Belagavi Division:** Belagavi, Dharwad, Gadag, Haveri, Vijayapura, Bagalkot, Uttara Kannada.
     * **Kalaburagi Division:** Kalaburagi, Bidar, Raichur, Koppal, Yadgir, Ballari, Vijayanagara.
  4. Real-time Socket event `sos_alert` is routed specifically to division/district police command rooms.

---

### 5.6 Algorithm 6: 3-Axis Accelerometer Shake-to-SOS Vector Processing
* **Module:** `frontend/src/screens/HomeScreen.tsx` & `SOSScreen.tsx`
* **Sensor Frequency:** $100\text{ ms}$ interval polling ($10\text{ Hz}$).
* **Vector Magnitude Formulation:**
  $$M = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
* **Threshold Condition:**
  $$\text{If } |M - 1.0G| > \text{SHAKE\_THRESHOLD } (2.8G - 3.2G):$$
  $$\text{Consecutive Shakes} \ge 3 \implies \text{Trigger Instant SOS}$$
* **Debouncing Filter:** $1500\text{ ms}$ refractory cooldown window to prevent repeated accidental triggers.

---

## 6. End-to-End Core Workflows

### 6.1 Workflow 1: Voice-Triggered Emergency & Acoustic Triage
```
[User screams "Help me!"]
          │
          ▼
[Mobile App Audio Buffer (expo-av)]
          │ (Uploads .wav payload to /api/sos/trigger-voice)
          ▼
+─────────────────────────────────────────────────────────────+
|               FastAPI AI Audio Pipeline                     |
|                                                             |
|   ┌────────────────────────┐   ┌────────────────────────┐   |
|   │  OpenAI Whisper (STT)  │   │ Librosa Acoustic Model │   |
|   │ "Help me! Leave me!"   │   │ Pitch: 310Hz, RMS: 0.09│   |
|   └───────────┬────────────┘   └───────────┬────────────┘   |
|               │                            │                |
|               └─────────────┬──────────────┘                |
|                             ▼                               |
|              ┌─────────────────────────────┐                |
|              │  Ollama (Phi-3 Mini LLM)    │                |
|              │  Danger: CRITICAL (Risk 94) │                |
|              └──────────────┬──────────────┘                |
+─────────────────────────────┼───────────────────────────────+
                              ▼
        ┌───────────────────────────────────────────┐
        │       Auto SOS Alert Creation (/alerts)   │
        └──────┬────────────────────────────┬───────┘
               │                            │
               ▼                            ▼
+──────────────────────────────+ +──────────────────────────────+
| Twilio Emergency Dispatcher  | | Socket.IO Live Telemetry Hub |
| - SMS with Google Maps Pin   | | - Broadcasts to Police Admin |
| - TwiML Voice Call to Family | | - Audio Siren Triggered      |
+──────────────────────────────+ +──────────────────────────────+
```

### 6.2 Workflow 2: Safe Route Navigation with Danger Avoidance
1. **Origin & Destination Selection:** User specifies target destination in `MapScreen.tsx`.
2. **Backend Query (`POST /api/ai/predict-route-safety`):**
   * Backend retrieves active SOS alerts and historical `danger_zones` within bounding coordinates.
   * `GridAStar` generates safe waypoint nodes penalizing danger zone intersection.
   * Google Directions API provides baseline polyline decoded into lat/long pairs.
3. **Route Safety Scoring:**
   * Ollama evaluates route safety factors, returning `safety_score` (0-100), `risk_level`, and actionable highlights (e.g., "Well-lit arterial corridor; police station within 400m").
4. **Live Navigation & Geofence Watch:**
   * App checks distance to closest danger zone on every GPS update ($O(1)$ Haversine).
   * If distance $< 100\text{m}$, device vibrates violently and issues safety alert.

### 6.3 Workflow 3: Live Walk Watch (SafeTimer) & Behavioral Deviation
1. User activates "Walk With Me" timer for an expected walking duration (e.g., 20 mins).
2. Continuous GPS telemetry is posted to `/api/location/update`.
3. Backend checks cross-track distance against `planned_route`:
   * If cross-track distance $> 50\text{m}$ OR user is stationary for $> 5\text{ mins}$ in an unlit zone, risk score elevates.
   * Check-in notification is triggered on mobile screen with a 60-second countdown.
   * If user fails to enter their secret PIN or dismiss the prompt, automated SOS is triggered.

### 6.4 Workflow 4: Incident Complaint Registration & Government Tracking
1. User submits an incident complaint via `SubmitComplaintScreen.tsx` (supports Anonymous mode).
2. Complaint is mapped to the exact district and division via `geo_mapping.py`.
3. Admin Command Dashboard displays complaints sorted by urgency with AI sentiment and keyword extraction.
4. Officers update status (`pending` $\to$ `investigating` $\to$ `resolved`) and post remarks.

---

## 7. Database Schemas (MongoDB Atlas)

### 7.1 `users` Collection
```json
{
  "_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "name": "Ananya Sharma",
  "email": "ananya.sharma@example.com",
  "phone": "+919876543210",
  "hashed_password": "$2b$12$e8uqY...hashed_bcrypt_string...",
  "role": "user",
  "division": "Bangalore Division",
  "district": "Bengaluru Urban",
  "is_active": true,
  "created_at": "2026-05-10T10:00:00.000Z"
}
```

### 7.2 `alerts` Collection (SOS Emergency Records)
```json
{
  "_id": "alt_84b7201c-7fc8-472d-9477-7429184518bf",
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "trigger_type": "voice_intelligence",
  "severity": "CRITICAL",
  "status": "active",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy": 4.5,
    "district": "Bengaluru Urban",
    "division": "Bangalore Division"
  },
  "message": "Help me! Someone is following me!",
  "ai_analysis": {
    "danger_level": "critical",
    "risk_score": 95,
    "emotion": "fear/scream",
    "acoustic_features": {
      "pitch_hz": 298.4,
      "energy_rms": 0.076,
      "speech_activity": 0.24
    },
    "detected_threats": ["stalking", "verbal distress"],
    "summary": "User screaming for help in isolated area."
  },
  "contacts_notified": ["+919876543211", "+919876543212"],
  "priority_score": 5,
  "created_at": "2026-08-26T18:15:30.000Z",
  "resolved_at": null
}
```

### 7.3 `danger_zones` Collection
```json
{
  "_id": "dz_c3848a94-4d81-4e78-9e51-39bc15b2e041",
  "name": "Underpass Corridor - Low Lighting",
  "location": {
    "latitude": 12.9756,
    "longitude": 77.5996
  },
  "radius_km": 0.5,
  "risk_score": 85,
  "district": "Bengaluru Urban",
  "division": "Bangalore Division",
  "factors": ["poor illumination", "isolated zone", "historical complaints"]
}
```

### 7.4 `complaints` Collection
```json
{
  "_id": "cmp_289410ea-7341-477d-bb91-230948ac0194",
  "user_id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "is_anonymous": false,
  "category": "Harassment / Stalking",
  "description": "Suspicious group loitering near metro exit at night.",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "MG Road Metro Station",
    "district": "Bengaluru Urban",
    "division": "Bangalore Division"
  },
  "status": "investigating",
  "priority": "HIGH",
  "assigned_officer": "Insp. R. Kumar",
  "created_at": "2026-08-26T14:20:00.000Z"
}
```

---

## 8. Complete API Endpoint Specification

| Method | Endpoint | Access Level | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register new citizen user or administrator with hashed password. |
| `POST` | `/api/auth/login` | Public | Authenticate credentials and receive signed HS256 JWT access token. |
| `POST` | `/api/sos/trigger` | Authenticated | Trigger manual one-tap or shake-based SOS emergency. |
| `POST` | `/api/sos/trigger-voice` | Authenticated | Upload WAV audio; executes Whisper STT, Librosa acoustics, and Ollama LLM. |
| `POST` | `/api/location/update` | Authenticated | Stream live GPS telemetry and check route deviation. |
| `POST` | `/api/ai/predict-route-safety` | Authenticated | Execute Grid A\* algorithm to generate safety-weighted paths avoiding danger zones. |
| `POST` | `/api/ai/analyze-text` | Authenticated | Evaluates textual distress messages using local LLM reasoning. |
| `POST` | `/api/ai/analyze-voice` | Authenticated | Standalone voice stress and panic acoustic analysis endpoint. |
| `POST` | `/api/ai/chat` | Authenticated | Conversational AI Safety Assistant powered by Ollama. |
| `GET` | `/api/ai/area-risk` | Authenticated | Spatial risk score calculation for coordinate bounding boxes. |
| `GET` | `/api/ai/nearby-services` | Authenticated | Live Overpass OSM discovery of police stations, hospitals, and clinics. |
| `GET` | `/api/ai/dashboard-stats` | Admin | Aggregated AI intelligence metrics for State Police Command Center. |
| `GET` | `/api/admin/alerts/active` | Admin | Real-time list of active, unresolved SOS incidents with telemetry. |
| `POST` | `/api/admin/alerts/{id}/resolve` | Admin | Mark active emergency as resolved and log resolution summary. |
| `POST` | `/api/complaints/submit` | Authenticated | File a formal or anonymous safety complaint. |
| `GET` | `/api/complaints/my` | Authenticated | Fetch citizen's complaint history and investigation tracking. |
| `POST` | `/api/broadcast/send` | Admin | Push state-wide or division-level public emergency safety broadcast alerts. |

---

## 9. Security, Privacy & Scalability Architecture

### 9.1 Authentication & Authorization
* **Cryptographic Security:** Passwords hashed with `bcrypt` (12 rounds of salting).
* **Stateless Tokens:** Access tokens issued via JSON Web Tokens (JWT) signed with `HS256`. Expire automatically after configured TTL.
* **Role-Based Access Control (RBAC):** Strict dependency validation (`get_current_user` and `require_admin`). Roles include `user`, `admin`, `district_admin`, `regional_admin`, and `super_admin`.

### 9.2 Data Privacy & Compliance
* **Anonymous Reporting:** Citizen complaint routes support complete masking of identity markers (`user_id`, personal identifiers).
* **Audio Ephemerality:** Temporary `.wav` audio files used for Whisper transcription and Librosa processing are automatically scrubbed post-inference to ensure zero audio data hoarding.

### 9.3 Asynchronous Scalability
* **Non-Blocking I/O:** Built entirely on Python's `asyncio` loop with Motor async MongoDB driver and FastAPI ASGI architecture.
* **Parallel Task Spawning:** Emergency telephony notifications (Twilio SMS and Voice Calls) execute in background tasks (`asyncio.create_task`) without adding latency to the client response cycle.

---

## 10. Comprehensive Project Viva Questions & Answers (50 Q&A)

### Section A: Core Architecture & Technologies
**Q1. What is the fundamental architecture of SafeHer AI?**
> **A:** SafeHer AI is a three-tier architecture comprising a cross-platform React Native / Expo mobile application for sensor telemetry and SOS activation, a high-concurrency FastAPI ASGI Python backend for AI orchestration and data management, and a React.js State Command Center web dashboard communicating via Socket.IO WebSockets and MongoDB Atlas.

**Q2. Why was FastAPI chosen over Django or Flask?**
> **A:** FastAPI is natively asynchronous (`async/await`), built on Starlette and Pydantic. It handles thousands of concurrent WebSocket telemetry connections and parallel asynchronous AI API requests with significantly lower latency and memory overhead than synchronous Flask or Django.

**Q3. How is the database organized and why was MongoDB selected?**
> **A:** MongoDB Atlas (NoSQL) was selected for its high write throughput for continuous GPS telemetry, dynamic AI metadata payloads (e.g. nested acoustic features and LLM inference trees), and native GeoJSON `2dsphere` spatial indexing for fast spatial radius queries.

**Q4. What is the role of Motor in the backend?**
> **A:** Motor is the official asynchronous, non-blocking Python driver for MongoDB. It integrates directly with FastAPI’s `asyncio` event loop, ensuring database reads/writes never block API request handling.

**Q5. How does the system handle real-time communication?**
> **A:** Bidirectional WebSockets via `python-socketio` in ASGI mode. The mobile app streams coordinates, and the backend broadcasts `location_update` and `sos_alert` events to Admin Dashboards instantly without polling.

---

### Section B: Artificial Intelligence, Audio & NLP
**Q6. What algorithm is used to compute the safest walking route?**
> **A:** A custom Safety-Weighted Grid A\* Pathfinding algorithm (`GridAStar`). It discretizes the route's bounding box into a 2D coordinate grid, calculates dynamic penalty weights for nodes intersecting danger zones and distress hotspots, and runs an $A^*$ search minimizing both distance and risk.

**Q7. What is the heuristic function used in the Grid A\* algorithm?**
> **A:** The great-circle Haversine distance from the current neighbor node to the target destination node: $h(n) = \text{Haversine}(n, \text{end})$.

**Q8. How does the voice stress analysis model work?**
> **A:** It uses `librosa` to extract acoustic features: fundamental frequency pitch ($F_0$) via `piptrack`, Root Mean Square (RMS) energy for volume/screaming, Zero Crossing Rate (ZCR) for speech agitation/tempo, and 13-band MFCCs. A multi-feature decision classifier then assigns a stress probability score.

**Q9. How does Whisper AI integrate with SafeHer AI?**
> **A:** OpenAI's Whisper (`base` model) is loaded lazily via PyTorch. When audio is uploaded to `/api/sos/trigger-voice`, Whisper performs sequence-to-sequence Transformer acoustic transcription to extract spoken words, even in noisy outdoor environments.

**Q10. How is the Local LLM used in threat detection?**
> **A:** Ollama runs a localized `phi3:mini` model. It receives the transcribed text, acoustic metadata, and location context. Using zero-shot safety prompt engineering and forced JSON formatting, it outputs danger levels, detected threats, risk scores (0-100), and automated emergency flags.

**Q11. What is lazy dependency loading in `voice_analyzer.py` and why is it essential?**
> **A:** PyTorch and Whisper require significant RAM and CUDA memory. Lazy loading (`_check_ai()` and `_check_librosa()`) delays importing these heavy libraries until the first audio upload, eliminating startup delays and preventing memory allocation crashes (e.g. Windows Error 1455).

**Q12. What happens if the Local LLM service is offline or unreachable?**
> **A:** The system incorporates graceful error handling: if the LLM fails, the backend falls back to deterministic rule-based acoustic stress scoring and keyword matching, ensuring the SOS is never blocked.

**Q13. What are the four danger classification levels produced by the AI?**
> **A:** `LOW` (Suspicious cues), `MEDIUM` (Unsafe environment), `HIGH` (Stalking or physical threat), and `CRITICAL` (Immediate violence or screaming).

**Q14. How are nearby emergency services retrieved and ranked?**
> **A:** Live amenities (police, hospitals, pharmacies) are queried from OpenStreetMap using the Overpass API, and then ranked either via an Ollama LLM prompt evaluating proximity and response capability or by deterministic Haversine distance ordering.

---

### Section C: Mobile Sensors & Hardware
**Q15. How does Shake-to-SOS work on the device?**
> **A:** The app monitors the device's 3-axis accelerometer at $10\text{ Hz}$. It computes the total acceleration vector magnitude $M = \sqrt{a_x^2 + a_y^2 + a_z^2}$. When $M$ exceeds $3.0G$ across 3 consecutive readings, an SOS event is dispatched with a $1.5\text{s}$ debounce filter.

**Q16. How does SafeHer track location in the background?**
> **A:** Using Expo Location's foreground and background location services, streaming GPS updates periodically to the backend whenever an active Trip or Walk With Me session is initiated.

**Q17. What is the Fake Call feature and why is it useful?**
> **A:** `FakeCallScreen.tsx` simulates an incoming native telephone call with ringtone, caller name, and pre-recorded voice audio. It allows women to discreetly exit uncomfortable or suspicious situations without escalating conflict.

**Q18. What is the SafeTimer (Walk With Me) feature?**
> **A:** An automated countdown timer for walking journeys. If the user does not mark themselves safe or confirm a periodic check-in before the timer expires, the system automatically escalates to a full SOS dispatch.

---

### Section D: Telephony, Emergency Dispatch & Administration
**Q19. How does Twilio integration function during a critical SOS?**
> **A:** `twilio_service.py` uses the Twilio REST API to dispatch high-priority SMS messages containing the victim's name, distress message, and a live Google Maps pinpoint link. For primary contacts, it initiates a TwiML Voice Call with automated Text-to-Speech synthesis.

**Q20. What is TwiML?**
> **A:** Twilio Markup Language (XML) instructions sent to Twilio servers (e.g., `<Response><Say voice="alice">Emergency Alert...</Say></Response>`) telling Twilio what to speak when the recipient answers the phone.

**Q21. How is jurisdictional police dispatch organized?**
> **A:** Karnataka's administrative hierarchy is mapped into 4 Revenue Divisions (Bangalore, Mysuru, Belagavi, Kalaburagi) and 31 Districts. Incidents are automatically assigned to the nearest district command center using centroid distance matching.

**Q22. What permissions exist in Role-Based Access Control (RBAC)?**
> **A:** Roles include `user` (citizen features), `district_admin` (local police station), `regional_admin` (revenue division level), and `super_admin` (state-wide oversight and broadcast dispatch).

**Q23. What is the Emergency Broadcast feature?**
> **A:** An admin feature allowing state police commanders to broadcast instant emergency push notifications and alerts across entire divisions or specific districts regarding weather, curfew, or safety incidents.

---

### Section E: Mathematical & Algorithmic Analysis
**Q24. What is the time complexity of the Haversine formula?**
> **A:** $O(1)$ constant time because it involves a fixed number of trigonometric transformations ($\sin, \cos, \arctan2$) independent of input size.

**Q25. What is the time complexity of the Grid A\* pathfinding implementation?**
> **A:** $O(V \log V + E)$ where $V = 676$ nodes ($26 \times 26$ grid) and $E \le 8V$. With a min-heap priority queue, path execution completes in $< 5\text{ milliseconds}$.

**Q26. Why is Zero Crossing Rate (ZCR) relevant in acoustic analysis?**
> **A:** ZCR measures how frequently the audio signal crosses the zero-amplitude line. High ZCR values correlate with unvoiced speech, heavy breathing, screaming, and high-frequency noise typical of panic situations.

**Q27. Why use 13 MFCC coefficients?**
> **A:** The first 13 Mel-Frequency Cepstral Coefficients capture the primary spectral envelope and human vocal tract characteristics while discarding speaker-specific pitch variations, optimizing timbre recognition for distress classification.

**Q28. How is the dynamic danger penalty calculated in the A\* grid?**
> **A:** $\text{penalty} = (1 - d/r) \times (s / 10.0)$, where $d$ is distance to the danger zone center, $r$ is radius, and $s$ is the risk score ($0-100$). The closer a node is to the center, the higher the traversal cost added to $g(n)$.

---

### Section F: Security, Edge Cases & Practical Scenarios
**Q29. How are passwords secured against rainbow table and brute-force attacks?**
> **A:** Passwords are salted with random cryptographic salts and hashed using `bcrypt` (adaptive hashing function with work factor 12).

**Q30. What happens if GPS coordinates are missing or reported as (0,0) during an SOS?**
> **A:** `alert_service.py` checks `location_history` in MongoDB for the user's last recorded valid coordinates and attaches them as a fallback with a high-accuracy timestamp.

**Q31. How is citizen privacy maintained for anonymous safety complaints?**
> **A:** When `is_anonymous` is true, the backend omits the `user_id` from the public complaint record, preventing identity tracing while still recording the incident location and category for police patrolling.

**Q32. How are temporary audio recordings handled to prevent privacy breaches?**
> **A:** Audio files written to `settings.UPLOAD_DIR` are deleted immediately after transcription and acoustic extraction are finalized.

**Q33. What prevents repeated accidental SOS triggers from device shaking?**
> **A:** A $1.5\text{-second}$ software debouncing refractory window combined with a 3-consecutive-sample gravity threshold filter.

**Q34. How does the system handle high concurrent SOS traffic during a city-wide incident?**
> **A:** FastAPI's ASGI event loop processes thousands of concurrent HTTP and WebSocket connections non-blockingly, and Twilio API dispatches run as decoupled asynchronous background tasks.

**Q35. What is the difference between `/api/sos/trigger` and `/api/sos/trigger-voice`?**
> **A:** `/api/sos/trigger` is a deterministic instant SOS (button or shake). `/api/sos/trigger-voice` receives raw audio, runs Whisper STT, Librosa acoustics, and Ollama LLM to dynamically evaluate danger before dispatching.

**Q36. How does the Admin Dashboard update without page refreshing?**
> **A:** It subscribes to WebSocket channels (`sos_alert`, `location_update`). When an event arrives, React state (`useState`/`useReducer`) updates immediately, rendering new markers and sounding the alert siren.

**Q37. What is the difference between primary and secondary emergency contacts?**
> **A:** Primary contacts receive both automated TwiML Voice calls and SMS messages with Google Maps links. Secondary contacts receive SMS notifications.

**Q38. Why is polyline decoding needed in walking navigation?**
> **A:** Google Directions API returns an encoded ASCII polyline string to conserve bandwidth. The backend / frontend decodes this string into explicit latitude/longitude coordinate pairs for mapping.

**Q39. What is Behavioral Deviation in route tracking?**
> **A:** Comparing the user's live coordinates against the `planned_route` polyline. If perpendicular cross-track deviation exceeds $50\text{m}$ or unexpected dwell time occurs, the system flags a potential deviation.

**Q40. How is CORS configured on the FastAPI server?**
> **A:** Using `CORSMiddleware` in `main.py`, configured with explicit allowed origins, methods (`*`), headers (`*`), and credential support for React Native and Vite dashboards.

---

### Section G: Advanced System & Viva Drill Questions
**Q41. How does the system ensure fast response time on mobile devices?**
> **A:** Network requests use timeout configurations, state updates are batched, and map markers use clustering to minimize re-renders.

**Q42. How are JWT tokens verified on protected API routes?**
> **A:** Through FastAPI's `Depends(get_current_user)` dependency injection, which decodes the `Authorization: Bearer <token>` header, verifies the signature, and retrieves user permissions.

**Q43. What is the role of Pydantic in the SafeHer backend?**
> **A:** Pydantic enforces strict runtime data validation, serialization, and type-hint schemas for all request payloads and responses, rejecting malformed JSON with HTTP 422 errors.

**Q44. How does the system distinguish between normal conversation and real danger in audio?**
> **A:** Through the fusion of Whisper transcription keywords (e.g. "help", "leave me", "stop") and Librosa acoustic indicators (pitch $> 250\text{Hz}$, RMS energy $> 0.05$), verified contextually by the LLM.

**Q45. Can the SafeHer system operate in regions outside Karnataka?**
> **A:** Yes. The administrative mapping gracefully falls back to "Unknown District / Unknown Division" while the core SOS, AI analysis, Twilio dispatch, and A\* routing function globally anywhere GPS is available.

**Q46. What audio formats are supported for voice analysis?**
> **A:** Any standard mobile format (`.m4a`, `.aac`, `.wav`, `.mp3`). `pydub` normalizes incoming audio into standard $16\text{ kHz}$ mono WAV format.

**Q47. How does the frontend handle token persistence across app restarts?**
> **A:** Using `AsyncStorage` or `expo-secure-store` to store the JWT token locally and reload it on application mount.

**Q48. What metrics are displayed on the State AI Command Center?**
> **A:** Global Threat Level (`NORMAL`, `ELEVATED`, `CRITICAL`), Active Distress Hotspots, Live SOS stream, Average Risk Score, Voice Stress Markers, and Jurisdictional Patrol Allocation status.

**Q49. Why is on-device/local LLM inference advantageous for women's safety platforms?**
> **A:** Local models (via Ollama) eliminate external cloud API costs, reduce reliance on external commercial rate limits, and provide superior privacy for sensitive emergency voice transcripts.

**Q50. In summary, how does SafeHer AI transform emergency response for women?**
> **A:** By eliminating manual dial delays through automated acoustic and physical triggers, providing intelligent predictive navigation around danger zones, and synchronizing real-time telemetry across family and state police command infrastructure in sub-second response times.
