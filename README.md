# Full-Stack Real-Time Communication App (WhatsApp Web Clone)

A production-ready, full-stack real-time communication application with 1-to-1 persistent text chat, **Group Chats**, **Image / Document / Voice Note Attachments**, and peer-to-peer real-time **Audio & Video Calling** powered by **WebSockets (Socket.io)** and **WebRTC**.

---

## 🌐 Live Production Links

- **Frontend (Vercel)**: [https://client-kohl-six-37.vercel.app](https://client-kohl-six-37.vercel.app)
- **Backend (Render)**: [https://chat-application-751k.onrender.com](https://chat-application-751k.onrender.com)
- **Database (MongoDB Atlas)**: Connected (`Chat_Application` cluster)

---

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, Socket.io Client.
- **Backend**: Node.js, Express, Socket.io, Mongoose, JSON Web Tokens (JWT), Bcrypt.js.
- **Database**: MongoDB (Atlas or local instance, with automatic zero-config `mongodb-memory-server` in-memory fallback for local dev).
- **Real-Time & Signaling**: Socket.io for live messaging, group chat rooms, presence (online/offline), typing indicators, and WebRTC SDP/ICE signaling.
- **Voice & Video**: WebRTC (`RTCPeerConnection` + `getUserMedia`) with free Google STUN servers, camera toggle, and custom Web Audio API ringtone synthesizer.
- **Media & Voice Notes**: HTML5 `MediaRecorder` for audio voice notes, File / Image attachments.

---

## 📁 Project Structure

```text
Chat system/
├── client/                     # Next.js App Router Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout with Auth & Socket providers
│   │   │   ├── page.tsx        # Main Chat Dashboard (Direct + Group + Video Call)
│   │   │   ├── login/page.tsx  # Authentication page (+ 1-click demo logins)
│   │   │   ├── register/page.tsx
│   │   │   └── globals.css     # Tailwind CSS styles & modern dark theme
│   │   ├── components/
│   │   │   ├── call/
│   │   │   │   ├── ActiveCallModal.tsx   # Video viewport, PiP camera, audio waves, mute & camera toggle
│   │   │   │   └── IncomingCallModal.tsx # Audio & Video incoming call popup with ringtone
│   │   │   ├── chat/
│   │   │   │   ├── ChatArea.tsx          # Chat window with Audio & Video call actions
│   │   │   │   ├── MessageBubble.tsx     # Text, Image preview, Audio player, and File download
│   │   │   │   ├── MessageInput.tsx      # Voice recorder, File/Image picker, Emojis
│   │   │   │   ├── Sidebar.tsx           # Chats & Groups tab switcher, search, call logs
│   │   │   │   ├── UserItem.tsx          # User row with unread badge & last message
│   │   │   │   ├── CreateGroupModal.tsx  # Create groups with member multi-select
│   │   │   │   └── CallLogsModal.tsx     # WebRTC call history & 1-click redial
│   │   │   └── ui/
│   │   │       └── Avatar.tsx            # Avatar with status dot & initials fallback
│   │   ├── context/
│   │   │   ├── AuthContext.tsx           # JWT authentication & session refresh
│   │   │   └── SocketContext.tsx         # Socket.io connection & presence map
│   │   ├── hooks/
│   │   │   └── useWebRTC.ts              # WebRTC state machine (Audio & Video streams, camera toggle)
│   │   ├── lib/
│   │   │   ├── api.ts                    # REST client with Bearer token injection
│   │   │   └── sound.ts                  # Web Audio synthesizer (ringtones & tones)
│   │   └── types/
│   │       └── index.ts                  # TypeScript definitions (User, Group, Message, CallLog)
│   └── package.json
│
├── server/                     # Express & Socket.io Backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── config.js       # Environment configuration
│   │   │   └── db.js           # Resilient Mongoose connection + in-memory fallback
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── userController.js
│   │   │   ├── messageController.js
│   │   │   ├── groupController.js
│   │   │   └── callController.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verification middleware
│   │   │   └── errorHandler.js # Global error handler
│   │   ├── models/
│   │   │   ├── User.js         # User schema (presence, credentials, avatar)
│   │   │   ├── Group.js        # Group schema (members, admins, creator)
│   │   │   ├── Message.js      # Message schema (text, image, file, audio, groupId)
│   │   │   └── CallLog.js      # CallLog schema (audio/video, status, duration)
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── messageRoutes.js
│   │   │   ├── groupRoutes.js
│   │   │   └── callRoutes.js
│   │   ├── sockets/
│   │   │   ├── presenceHandler.js # Presence tracking & auto-joining group rooms
│   │   │   ├── chatHandler.js     # Direct & group messaging, typing, attachments
│   │   │   ├── callHandler.js     # WebRTC Audio & Video signaling
│   │   │   └── socketManager.js   # Socket.io auth handshake and setup
│   │   ├── utils/
│   │   │   ├── seed.js         # Demo accounts (Alice, Bob, Charlie) & team group
│   │   │   └── token.js        # JWT generation and verification
│   │   └── server.js           # Server entry point
│   ├── .env                    # Server environment variables
│   └── package.json
│
├── package.json                # Root package configuration
└── README.md
```

---

## 🗄️ Connecting to your own MongoDB (MongoDB Atlas)

**হ্যাঁ, আপনার MongoDB Atlas ক্লাউড ডেটাবেস কানেক্ট করা খুবই সহজ:**

1. [MongoDB Atlas](https://cloud.mongodb.com/) এ গিয়ে একটি ক্লাস্টার তৈরি করে আপনার Connection String কপি করুন:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/chatsystem?retryWrites=true&w=majority
   ```
2. `server/.env` ফাইলে `MONGO_URI` হিসেবে সেটি বসিয়ে দিন:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:3000
   JWT_SECRET=supersecret_jwt_key_chat_app_2026_production
   MONGO_URI=mongodb+srv://yourUser:yourPassword@cluster0.abcde.mongodb.net/chatsystem?retryWrites=true&w=majority
   NODE_ENV=production
   ```
3. ব্যাস! সার্ভার রিস্টার্ট দিলে এটি সরাসরি আপনার MongoDB Atlas ক্লাউডে কানেক্ট হবে এবং ইউজার, মেসেজ, গ্রুপ, ফাইল ও কল লগ সরাসরি আপনার ক্লাউড ডেটাবেসে স্থায়ীভাবে সংরক্ষিত থাকবে।

---

## ⚡ Quick Start

### 1. Running the Backend Server
```bash
cd server
npm run dev
```
The server will start on `http://localhost:5000`.

### 2. Running the Frontend Client
```bash
cd client
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Testing Guide

1. **Tab 1**: Login as **"👩 Alice"** (`alice@example.com` / `password123`).
2. **Tab 2 (Incognito)**: Login as **"👨 Bob"** (`bob@example.com` / `password123`).
3. **Test Video Calling**:
   - Alice-এর উইন্ডোতে Bob-এর সাথে চ্যাটে গিয়ে হেডার থেকে **"Video"** বাটনে ক্লিক করুন।
   - Alice দেখতে পাবে আউটগোয়িং কল এবং লোকাল ক্যামেরা প্রিভিউ।
   - Bob-এর কাছে **"Incoming Video Call"** পপআপ আসবে। **"Accept"** বাটনে ক্লিক করলে:
     - লাইভ পিয়ার-টু-পিয়ার এইচডি ভিডিও স্ট্রিম শুরু হবে।
     - কর্নারে নিজের ছোট ক্যামেরা প্রিভিউ (Picture-in-Picture) থাকবে।
     - **Camera Toggle** ও **Mic Mute** বাটন দিয়ে ক্যামেরা অন/অফ ও মাইক মিউট টেস্ট করুন।
4. **Test Attachments & Voice Notes**:
   - ইনপুট বারের **Paperclip (📎)** বাটনে ক্লিক করে যেকোনো **Image** বা **Document/File** সিলেক্ট করুন এবং Send করুন।
   - ইনপুট বার ফাঁকা রেখে ডানপাশের **Mic (🎙️)** আইকনে ক্লিক করে সরাসরি ভয়েস নোট রেকর্ড করুন এবং Send বাটনে ক্লিক করে পাঠিয়ে দিন। অপর প্রান্তে ইন-লাইন অডিও প্লেয়ারে প্লে হবে!
5. **Test Group Chat**:
   - সাইডবারে **"Groups"** ট্যাবে ক্লিক করুন। প্রাক-কনফিগার করা **"🚀 Dev & Product Squad"** গ্রুপ দেখতে পাবেন।
   - সাইডবারের হেডার থেকে **UserPlus (👥+)** বাটনে ক্লিক করে নতুন গ্রুপ তৈরি করুন, মেম্বার সিলেক্ট করুন এবং রিয়েল-টাইম গ্রুপ মেসেজ ও গ্রুপ টাইপিং ইন্ডিকেটর টেস্ট করুন।
