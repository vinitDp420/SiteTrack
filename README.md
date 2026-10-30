# 🏗️ SiteTrack — AI-Powered Construction Workforce & Site Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-orange?style=for-the-badge&logo=tensorflow)](https://www.tensorflow.org/js)
[![Prisma](https://img.shields.io/badge/Prisma-5.20-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

> **SiteTrack** is a modern, enterprise-grade AI construction management and biometric workforce tracking platform. It replaces manual registers and password-based worker logins with an intelligent **Hands-Free Face Scan Attendance Terminal**, live **CCTV AI safety & PPE compliance monitoring**, automated **daily wage payouts**, and comprehensive **project management** (BOQ, procurement, inventory, tasks, and daily reports).

---

## 🌟 Key Features

### 1. 📷 Biometric Face Scan Attendance Machine (Zero Password Required)
- **No Individual Credentials Needed**: On-site workers never need to type usernames, emails, or passwords.
- **1st Scan = Automatic Clock IN**: Recognizes enrolled worker faces in real-time and starts their active shift.
- **2nd Scan = Automatic Clock OUT**: Automatically calculates total shift hours worked and initiates daily wage payout.
- **3-Second Deliberate Hold Timer**: Features a visual countdown hold (`3s ➔ 2s ➔ 1s ➔ Verified!`) ensuring accurate, intentional detection without twitchy triggers.
- **25-Second Anti-Double-Scan Protection**: Protects workers from accidentally clocking out if they remain in front of the camera right after clocking in.
- **Continuous Hands-Free Queue**: 4-second celebratory banner display before smoothly resuming scanning for the next worker in line.
- **Audio Chimes & Voice Feedback**: Audible success chimes with dynamic text-to-speech announcements (*"Welcome Vivek! Shift clocked in."*).
- **Multi-Camera Support**: Seamlessly switch between integrated PC webcams, USB cameras, and mobile cameras (e.g., via Iriun Webcam).
- **Offline Attendance Queue**: Records attendance locally via IndexedDB during internet disruptions and automatically synchronizes when reconnected.

### 2. 🎥 CCTV Stream & Edge AI Safety Monitoring
- **Live RTSP / HLS CCTV Streams**: Real-time video feeds with WebRTC / HLS.js streaming.
- **Worker Presence & Face Recognition**: Decoupled AI pipeline combining COCO-SSD object detection with Face-API facial recognition.
- **PPE Safety Compliance**: Instant detection of Hard Hats / Safety Helmets and alerts for non-compliant workers.
- **Fraud & Perimeter Alerts**: Real-time alerts when unauthorized or unregistered persons enter active construction zones.

### 3. 💰 Automated Daily Wage Payouts & Payroll
- **Instant Check-Out Calculation**: Shifts under 7 hours are marked as `HALF_DAY`, shifts 7+ hours are marked as `PRESENT`.
- **Integrated Daily Payouts**: Automated webhook payout trigger (Razorpay payout simulation) immediately upon Clock Out.
- **Payslips & Wage History**: Digital pay slip generation for workers and daily/monthly payroll summaries for site supervisors.

### 4. 📊 Comprehensive Construction Project Management
- **Bill of Quantities (BOQ)**: Track itemized materials, planned vs. actual consumption, unit rates, and cost variances.
- **Procurement & Inventory**: Manage material requisitions, stock counts, low-stock warnings, and supervisor approvals.
- **Asset & Machinery Tracking**: Monitor heavy equipment, vehicles, and power tools assigned across sites.
- **Daily Tasks & Milestones**: Assign tasks to worker teams, track milestone completion percentages, and log weather delays.
- **Role-Based Portals**:
  - **Administrator**: Full executive dashboard, financial BOQ, payroll disbursements, project configuration.
  - **Supervisor**: Site operations, task assignments, manual attendance override, live CCTV monitoring.
  - **Worker**: Dedicated Biometric Face Scan Station, shift history, and digital wage slips.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **AI / Computer Vision** | [TensorFlow.js](https://www.tensorflow.org/js) (WebGL & CPU Backends), [Face-API.js](https://github.com/justadudewhohacks/face-api.js), `@tensorflow-models/coco-ssd` |
| **Database & ORM** | [Prisma ORM](https://www.prisma.io/) with PostgreSQL (SQLite / Supabase compatible) |
| **Authentication** | [NextAuth.js](https://next-auth.js.org/) (JWT Strategy, Role-based route middleware) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), Material Symbols |
| **Streaming** | [HLS.js](https://github.com/video-dev/hls.js), WebRTC, MediaDevices API |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` / `v24.x`
- **npm** or **pnpm** / **yarn**
- Modern Web Browser with WebGL enabled (Google Chrome, Microsoft Edge, Brave, etc.)
- Integrated Webcam or Mobile Camera (via [Iriun Webcam](https://iriun.com/))

---

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/sitetrack.git
   cd sitetrack
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Note: The custom `postinstall` script automatically removes nested legacy `@tensorflow` sub-packages inside `face-api.js` to ensure clean compatibility with TensorFlow.js 4.x).*

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   # Database Connection (PostgreSQL or SQLite)
   DATABASE_URL="postgresql://postgres:password@localhost:5432/sitetrack?schema=public"

   # NextAuth Authentication
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-super-secret-jwt-key-replace-in-production"

   # Razorpay Configuration (Optional / Sandbox Simulation)
   RAZORPAY_KEY_ID="rzp_test_sampleKey"
   RAZORPAY_KEY_SECRET="sampleSecretKey"
   ```

4. **Initialize Database Schema & Seeds**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

6. **Open in Browser**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Default Demo Accounts

For testing different roles, the following pre-configured accounts are available:

| Role | Email / Username | Password | Access Level |
|---|---|---|---|
| **Administrator** | `admin@sitetrack.com` | `Admin@123` | Executive Dashboard, Payroll, BOQ, All Projects |
| **Supervisor** | `supervisor@sitetrack.com` | `Supervisor@123` | Site Operations, Worker Onboarding, CCTV AI |
| **Worker Portal** | **Biometric Face Scan** | *No Password* | Stand in front of camera at `/login` or `/kiosk` |
| **Worker (Manual)** | `worker@sitetrack.com` | `Worker@123` | Legacy worker personal dashboard fallback |

---

## 📱 How to Use the Worker Biometric Station

1. Navigate to **`http://localhost:3000/login`** and select the **"Worker"** role (or open **`http://localhost:3000/kiosk`** for dedicated gate terminal mode).
2. Click **"Start Face Camera"** (allow camera permissions).
3. If using a mobile phone as a wireless camera via Iriun, select **"Iriun Webcam"** from the camera dropdown.
4. **Clock In (1st Scan)**:
   - Stand in front of the lens.
   - The HUD will lock onto your face: `⏳ Hold still: 3s remaining...`
   - After 3 seconds, a green confirmation card appears: `🎉 1st Scan: Checked In! Welcome [Name]!`
   - A chime plays and voice announces check-in.
5. **Clock Out (2nd Scan)**:
   - When your shift finishes, step in front of the camera again.
   - After the 3-second hold, a red/amber card appears: `👋 2nd Scan: Checked Out! Goodbye [Name]! Shift: 8.2 hrs • Wage: ₹600`.
   - Daily wage payout is calculated and queued.
6. The terminal automatically resets after 4 seconds for the next worker in line.

---

## 📁 Project Structure

```
├── prisma/
│   └── schema.prisma         # Database schema (Worker, Attendance, BOQ, Payment, etc.)
├── public/
│   ├── models/               # Face-API weights (tiny_face_detector, landmarks, recognition)
│   └── uploads/              # Registered worker enrollment photos
├── src/
│   ├── app/
│   │   ├── admin/            # Admin & Supervisor portal (monitoring, boq, payroll, workers)
│   │   ├── api/              # REST API endpoints (attendance, workers, projects, auth)
│   │   ├── kiosk/            # Standalone Full-Screen Biometric Gate Terminal
│   │   ├── login/            # Unified entry point with embedded Face Machine
│   │   └── worker/           # Worker portal & personal shift history
│   ├── components/
│   │   ├── CCTVFeed.tsx      # Real-time HLS video + COCO-SSD + Face recognition
│   │   ├── WorkerFaceKiosk.tsx # Biometric face scan machine with In/Out toggle
│   │   └── Navbar.tsx        # Responsive navigation
│   └── lib/
│       ├── offline-queue.ts  # IndexedDB offline attendance queue & background sync
│       ├── payout-service.ts # Automated daily payout calculation
│       └── prisma.ts         # Prisma client singleton
└── package.json
```

---

## 🛡️ Security & Privacy
- **Vectorized Face Descriptors**: Face data is extracted into mathematical 128-float embedding vectors; raw face photos are safely stored and never exposed publicly.
- **Anti-Spoofing & Cooldowns**: Enforces facial landmark consistency and time-based debounce protection to prevent accidental duplicate punches.
- **Role-Based Middleware**: Sensitive financial routes (`/admin/payments`, `/admin/payroll`, `/admin/boq`) are strictly protected against unauthorized access.

---

## 📄 License
This project is licensed under the **MIT License**. Feel free to use, modify, and distribute for commercial or academic capstone purposes.
