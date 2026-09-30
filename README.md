# Shofi Chat — Real-Time Messaging & WebRTC Calling Platform

A modern, production-grade real-time communication platform built with **Next.js 16**, **React 19**, **Node.js**, **Express**, **Socket.io**, and **WebRTC**. Features end-to-end messaging, 1-to-1 & group chats, voice notes, media file sharing, peer-to-peer HD audio/video calls, Google OAuth 2.0 authentication, Cloudinary media storage, and a robust administrative control panel.

---

## 🌐 Live Production Links

* **Frontend (Vercel)**: [https://shofichat.vercel.app](https://shofichat.vercel.app)
* **Backend API & WebSockets (Render)**: [https://chat-application-751k.onrender.com](https://chat-application-751k.onrender.com)
* **Database (MongoDB Atlas)**: Hosted on AWS MongoDB Atlas Cluster (`Chat_Application`)

---

## ✨ Features

* **⚡ Real-Time Messaging**: Instant 1-to-1 and group messaging with Socket.io, real-time typing indicators, read receipts, and online/offline presence tracking.
* **📞 HD Audio & Video Calling**: Peer-to-peer WebRTC calling with live camera preview (PiP), mute/camera toggle, audio frequency visualizers, and ringtones.
* **🔒 Google OAuth 2.0 & Token Auth**: Secure Google Sign-In with automatic profile provisioning, JWT session tokens, and password protection.
* **🖼️ Cloudinary Media & Voice Notes**: Direct file and image attachments, voice note audio recording (`MediaRecorder`), and device gallery/camera photo uploads.
* **👤 User Profiles & Fixed Handles**: Display names, custom avatars, and bios. Usernames are permanently locked to the user's email handle (`@username`) to ensure consistency.
* **🛡️ Super Admin Panel**: Dedicated control panel for super administrators to manage user accounts, suspend/ban users, delete profiles, toggle demo login access, and view platform metrics.
* **👥 Friends & Blocking System**: Send, accept, or decline friend requests; block/unfriend users with synchronized socket notifications.
* **🗑️ Permanent Message Deletion**: Synchronized deletion across both root message collections and nested group/conversation documents with zero browser alert popups.
* **⏱️ Auto-Retention & Cleanup**: Automated cron-based background cleanup job for conversations according to custom user-defined retention settings (1–15 days).

---

## 🚀 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Socket.io-client |
| **Backend** | Node.js, Express 4, Socket.io 4, Mongoose 8, JSON Web Tokens (JWT), Bcrypt.js, Cloudinary SDK |
| **Database** | MongoDB Atlas (Production) / Mongoose with MongoMemoryServer fallback for local testing |
| **Real-Time** | WebSockets (Socket.io) for bidirectional events, WebRTC (Google STUN) for audio/video calling |
| **Storage** | Cloudinary API for profile pictures and media assets |

---

## 📁 Repository Structure

```text
Chat system/
├── client/                     # Next.js 16 App Router Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root application layout with context providers
│   │   │   ├── page.tsx        # Main chat dashboard (Direct, Group, Calls)
│   │   │   ├── login/page.tsx  # Authentication page with Google OAuth
│   │   │   ├── register/page.tsx # Account registration page
│   │   │   └── globals.css     # Global styles & Tailwind CSS v4 tokens
│   │   ├── components/
│   │   │   ├── admin/          # Super Admin dashboard modal
│   │   │   ├── call/           # WebRTC active & incoming call dialogs
│   │   │   ├── chat/           # Chat area, bubbles, input, sidebar, settings
│   │   │   └── ui/             # Avatar, skeleton, and confirmation modals
│   │   ├── context/            # AuthContext and SocketContext
│   │   ├── hooks/              # useWebRTC audio/video call hook
│   │   ├── lib/                # API client and sound synthesizer utilities
│   │   └── types/              # Unified TypeScript interfaces
│   ├── .env.example            # Client environment variables reference
│   └── package.json
│
├── server/                     # Express & Socket.io Backend
│   ├── src/
│   │   ├── config/             # Environment & MongoDB connection setup
│   │   ├── controllers/        # Auth, User, Message, Group, Admin, Call controllers
│   │   ├── middleware/         # JWT verification, Admin authorization, Error handling
│   │   ├── models/             # Mongoose schemas (User, Message, Conversation, Group, CallLog)
│   │   ├── routes/             # REST API endpoint routes
│   │   ├── sockets/            # Presence, Messaging, and WebRTC signaling handlers
│   │   └── utils/              # Token, Cloudinary image upload, and background cleanup jobs
│   ├── .env.example            # Server environment variables reference
│   └── package.json
│
└── README.md                   # Project documentation
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
* Node.js v18.0.0 or higher
* npm or yarn
* (Optional) MongoDB installed locally or a free MongoDB Atlas connection string

### 2. Backend Setup
```bash
cd server
npm install
```

Create a `.env` file inside `server/` (refer to `server/.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/Chat_Application?retryWrites=true&w=majority
JWT_SECRET=supersecret_jwt_key_chat_app_2026_production
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:5000
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Start the backend development server:
```bash
npm run dev
```
Backend will run at `http://localhost:5000`.

### 3. Frontend Setup
```bash
cd ../client
npm install
```

Create a `.env.local` file inside `client/`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

Start the frontend development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Production Deployment & Live Settings Guide

### 1. MongoDB Atlas Configuration
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/) and navigate to **Network Access**.
2. Ensure `0.0.0.0/0` (Allow Access from Anywhere) is whitelisted so cloud platforms like Render or Vercel can connect without connection timeouts.
3. In **Database Access**, verify your database user has `readWriteAnyDatabase` privileges.
4. Copy the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster.mongodb.net/Chat_Application?retryWrites=true&w=majority
   ```

### 2. Google Cloud Console (OAuth 2.0 Credentials)
1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Select your project and click your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized JavaScript origins**, add:
   * `http://localhost:3000` (Local testing)
   * `https://shofichat.vercel.app` (Live frontend)
4. Under **Authorized redirect URIs**, add:
   * `http://localhost:5000/api/auth/google/callback` (Local backend)
   * `https://chat-application-751k.onrender.com/api/auth/google/callback` (Live backend)
5. Save changes.

### 3. Backend Deployment (e.g. Render / Railway / VPS)
1. Link your GitHub repository to Render (Web Service).
2. Set **Root Directory**: `server`
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `npm start`
5. Configure Environment Variables in the Render Dashboard:
   * `PORT`: `5000` (or leave default assigned by host)
   * `NODE_ENV`: `production`
   * `MONGO_URI`: Your MongoDB Atlas connection string
   * `JWT_SECRET`: A strong random string
   * `CLIENT_URL`: `https://shofichat.vercel.app` (or comma-separated with localhost)
   * `SERVER_URL`: `https://chat-application-751k.onrender.com`
   * `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   * `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   * `GOOGLE_CALLBACK_URL`: `https://chat-application-751k.onrender.com/api/auth/google/callback`
   * `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
   * `CLOUDINARY_API_KEY`: Your Cloudinary API key
   * `CLOUDINARY_API_SECRET`: Your Cloudinary API secret

### 4. Frontend Deployment (Vercel)
1. Import your GitHub repository into [Vercel](https://vercel.com/).
2. Set **Root Directory**: `client`
3. Framework Preset: **Next.js**
4. Configure Environment Variables in the Vercel Project Settings:
   * `NEXT_PUBLIC_API_URL`: `https://chat-application-751k.onrender.com/api`
   * `NEXT_PUBLIC_SOCKET_URL`: `https://chat-application-751k.onrender.com`
   * `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Your Google OAuth client ID
5. Deploy.

---

## 🧪 Testing & Verification Guide

1. **Authentication**:
   * Click **Sign in with Google** to authenticate with your Google account.
   * Your username is automatically created from your email prefix (`@email_handle`).
2. **Profile & Customization**:
   * Click your profile avatar on the sidebar to open **Settings**.
   * Update your Display Name, Bio, and upload a custom photo from your device.
   * Notice that your Username is safely locked to your email handle.
3. **1-to-1 & Group Chats**:
   * Send text, emoji, file attachments, and record voice notes.
   * Click the trash icon to delete messages; verify that messages are permanently removed from both UI and database upon refresh.
4. **Audio & Video Calls**:
   * Click the **Video** or **Phone** icon in the chat header to initiate a peer-to-peer WebRTC call.
   * Accept the call on another device/browser to test bidirectional video/audio streams and picture-in-picture preview.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
