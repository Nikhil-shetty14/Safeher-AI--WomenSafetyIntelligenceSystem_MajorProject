# SafeHer AI - Deployment Guide

This guide outlines the steps required to deploy the SafeHer AI Women Safety Intelligence System, which consists of three main components:
1.  **FastAPI Backend** (AI processing, APIs, WebSockets)
2.  **React Native Mobile App** (User-facing emergency app)
3.  **React Admin Dashboard** (Command center for monitoring)

## 1. Backend Deployment (FastAPI)
The backend should be deployed to a scalable cloud provider like AWS EC2, Heroku, or Render to support WebSocket connections and AI processing.

### Prerequisites
- Python 3.10+
- MongoDB Atlas cluster URL
- OpenAI API Key (for GPT-4/LLaMA & Whisper)
- Twilio Account SID, Auth Token, and Phone Number (for SOS calls/SMS)

### Steps
1.  **Clone the repository** and navigate to the `backend/` folder.
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Set Environment Variables**: Create a `.env` file in the backend directory.
    ```env
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET_KEY=your_secure_jwt_secret
    OPENAI_API_KEY=your_openai_api_key
    TWILIO_ACCOUNT_SID=your_twilio_sid
    TWILIO_AUTH_TOKEN=your_twilio_auth_token
    TWILIO_PHONE_NUMBER=your_twilio_phone
    ```
4.  **Run with Gunicorn (Production)**:
    ```bash
    gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
    ```

## 2. Admin Dashboard Deployment (React)
The dashboard can be deployed as a static site to Vercel, Netlify, or AWS S3.

### Steps
1.  Navigate to `admin-dashboard/`.
2.  Install dependencies: `npm install`
3.  Configure API URLs: Update the backend API URL in `src/api/config.js` or via a `.env` file (`REACT_APP_API_URL=https://your-backend.com`).
4.  Build for production:
    ```bash
    npm run build
    ```
5.  Deploy the generated `build/` folder to Vercel/Netlify.

## 3. Mobile App Deployment (React Native / Expo)
The mobile application is built using Expo, making deployment to the App Store and Google Play straightforward using EAS (Expo Application Services).

### Steps
1.  Navigate to `frontend/`.
2.  Install dependencies: `npm install`
3.  Update the backend API and Socket URL in `src/api/client.ts`.
4.  Configure EAS: Initialize EAS build configuration.
    ```bash
    npx eas build:configure
    ```
5.  Build the App:
    - For Android (APK):
      ```bash
      npx eas build --profile preview --platform android
      ```
    - For iOS (requires Apple Developer Account):
      ```bash
      npx eas build --profile production --platform ios
      ```
6.  Publish to Stores: Use `eas submit` to submit the binaries to Google Play Console and Apple App Store Connect.

## Security Considerations
- Keep all `.env` files out of version control.
- Enforce HTTPS for backend communications to protect sensitive location and audio data.
- Regularly rotate Twilio and OpenAI API keys.
