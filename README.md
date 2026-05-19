# 🛡️ SafeHer AI — Women Safety Intelligence System

> **An AI-powered, real-time Women Safety Platform built for quick response, intelligent threat analysis, and continuous monitoring.**
> 
> **Tech Stack:** React Native · FastAPI · MongoDB · Socket.IO · GPT-4 · Whisper

![SafeHer AI Banner](https://via.placeholder.com/1000x300.png?text=SafeHer+AI+-+Women+Safety+Platform)

---

## 🌟 Key Features

- **🆘 Instant SOS with One-Tap / Shake / Voice:** Trigger emergency alerts seamlessly via multiple channels.
- **🤖 AI Danger Analysis:** Uses GPT-4 to analyze text inputs and Whisper AI for stress/voice analysis to assess threat levels.
- **📍 Real-time Location Tracking:** Live GPS tracking broadcasted to trusted contacts and the Admin Dashboard via Socket.IO.
- **🚨 Automated Emergency Dispatch:** Automatically sends SMS and initiates calls via Twilio to emergency contacts.
- **📊 Admin Dashboard:** Comprehensive real-time monitoring portal with a heat map, active alerts, and user analytics.
- **📱 Premium Command Center UI:** A stunning, dark-themed mobile dashboard featuring an animated SOS trigger, live AI safety scoring, offline mode, and quick access to silent/stealth features.
- **💬 SafeHer AI Chatbot:** An intelligent companion that can converse, assess the situation, and proactively trigger alerts if danger is detected.
- **👥 Emergency Contacts Management:** Easily manage primary and secondary trusted contacts.
- **🎧 Audio Evidence Collection:** Automatically records and uploads emergency surroundings for AI analysis.

---

## 📁 Project Architecture

The platform is split into three main components:

```
SafeHer AI/
├── backend/                    # FastAPI Python backend (AI, WebSockets, REST APIs)
├── frontend/                   # React Native + Expo mobile application
└── admin-dashboard/            # React.js + Vite web admin portal
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate     # Windows
# source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
# Edit .env and fill in your API keys (MongoDB, OpenAI, Twilio, Google Maps)

# Run the server
python run.py
# API documentation available at: http://localhost:8000/docs
```

### 2. Mobile App Setup (React Native / Expo)

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
# Edit .env and set API_BASE_URL to your machine's local IP address
# e.g., API_BASE_URL=http://192.168.1.XXX:8000

# Start Expo server
npm start
# Scan the QR code with the Expo Go app on your mobile device
```

### 3. Admin Dashboard Setup (React + Vite)

```bash
cd admin-dashboard

# Install dependencies
npm install

# Start the development server
npm run dev
# Open http://localhost:5173 in your browser
```

---

## 🔑 Environment Variables

### Backend `.env` Required Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing secret (min 32 chars) |
| `MONGODB_URL` | MongoDB Atlas connection string |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 and Whisper |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS/Calls |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio phone number |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key (Optional) |
| `GOOGLE_MAPS_API_KEY` | Google Maps Platform key (Optional) |

### Frontend `.env` Required Variables

| Variable | Description |
|----------|-------------|
| `API_BASE_URL` | Backend URL (e.g., `http://192.168.1.100:8000`) |
| `SOCKET_URL` | Socket.IO URL (typically same as backend) |

---

## 🤖 AI Feature Workflow

1. **User Input:** Text or Voice audio is sent to the backend.
2. **Transcription:** Audio is processed via Whisper AI.
3. **Analysis:** The transcript/text is passed to GPT-4.
4. **Decision:** The AI evaluates the **danger_level** and **confidence_score**.
5. **Action:** If `trigger_emergency` is determined true:
   - SMS is sent via Twilio to Emergency Contacts.
   - A voice call is initiated to the Primary Contact.
   - The Admin Dashboard receives a high-priority WebSocket alert.

---

## 📡 Core API Reference

- **`POST /api/auth/register`** - Register new user
- **`POST /api/auth/login`** - Authenticate and get JWT token
- **`POST /api/sos/trigger`** - Trigger an immediate SOS alert
- **`POST /api/sos/trigger-voice`** - Trigger an SOS alert with a voice recording upload
- **`POST /api/ai/analyze-text`** - Analyze text using LLM for potential danger
- **`POST /api/location/update`** - Send live GPS coordinates
- **`GET /api/admin/alerts/active`** - Retrieve active SOS alerts for the dashboard

*(Full API docs are automatically generated at `/docs` when running the backend).*

---

## 🔒 Security Practices

- Passwords are securely hashed using **bcrypt**.
- Authentication is handled via **JWT tokens**.
- Protected routes require valid headers.
- Admin APIs are segregated by RBAC (Role-Based Access Control).
- Environment variables are kept out of source control.

---

## 📞 Emergency Numbers (India)

| Service | Number |
|---------|--------|
| Police | 100 |
| Women's Helpline | 1091 |
| National Emergency | 112 |
| Ambulance | 108 |

---

*Built with ❤️ for women's safety — SafeHer AI*