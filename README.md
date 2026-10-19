# ⚡ WebForge Live — Synchronized Team Quiz Platform

A high-stakes, Quiz.com-style live team tournament quiz platform built with **React + Vite**, **Python Flask + Flask-SocketIO**, and **MongoDB Atlas** (with auto-detecting embedded local fallback). Designed to reliably handle **100+ simultaneously connected teams** with server-authoritative synchronized countdowns, atomic single-device session leases, speed-based scoring, and instant early reveal.

---

## 🌟 Key Features

1. **Restricted Team Authentication & Session Leasing**
   - Organizer-issued credentials (e.g. `TEAM001`, `ALPHA`) with secure hashed passwords.
   - **Atomic single-session guarantee**: Prevents concurrent logins using the same credentials on multiple devices (returns 409 Conflict).
   - Reconnection tolerance: Session lease grace period lets teams recover seamlessly after page refreshes or momentary network loss.
   - Host session release: Organizers can release stuck sessions with one click from Mission Control.

2. **Server-Authoritative Synchronized State Machine**
   - States: `LOBBY` ➔ `READY` ➔ `QUESTION_OPEN` ➔ `REVEAL` ➔ `QUESTION_CLOSED` ➔ `COMPLETED` (supports `PAUSED` / `RESUMED`).
   - Official server deadline timestamp (`deadline_at` in epoch ms) controls the round; client devices render display-only countdowns.
   - Real-time WebSockets powered by Socket.IO.

3. **Speed-Based Scoring Formula**
   $$\text{Score} = \begin{cases} 0 & \text{if incorrect, unanswered, or late} \\ \max\left(0, \left\lfloor B \times \left(1 - \frac{t}{T}\right) \right\rfloor\right) & \text{if correct} \end{cases}$$
   - $B$: Max points (e.g. 1000)
   - $T$: Question duration in ms
   - $t$: Elapsed ms from question open to server receipt

4. **Automatic Early Reveal Logic**
   - Reveal triggers immediately when **all eligible connected teams have submitted**, without forcing teams to wait for the timer to expire.
   - If timer expires first, reveal automatically initiates and locks unanswered teams at 0 points.
   - Answers and explanations remain strictly server-side until the reveal state transition.

5. **Host Mission Control & Telemetry**
   - Live telemetry: active socket connections, registered teams count, live answer submission gauge.
   - Question bank manager: MCQ editor, points and duration customization, order configuration.
   - Team roster: manual creation, bulk CSV import (`team_id,team_name,password`), session unlock.
   - Official CSV export: 1-click download of ranked scores, correct tallies, and total elapsed time.

6. **Cyberpunk & Glassmorphism Design System**
   - Obsidian dark mode with neon accents and vibrant option palettes.
   - Zero-dependency **Web Audio API synthesizer** for countdown ticks, lock-in chimes, and victory fanfares.
   - Animated Top-3 Olympic podium with confetti celebrations.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+

### ⚡ One-Step Launch (Recommended)
Run both Frontend & Backend concurrently with a single command:
```bash
python live.py
```
This automatically:
- Boots the Flask + Socket.IO backend on port 5000
- Launches the Vite React frontend on port 3000
- Automatically opens your default web browser to `http://127.0.0.1:3000`
- Provides graceful shutdown of all processes when you press `Ctrl+C`

---

### Manual Launch (Alternative)

#### 1. Backend Setup & Launch
```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run server (defaults to http://localhost:5000)
python run.py
```
> **Note on MongoDB**: By default, the backend automatically initializes an in-memory database with unique indexes for zero-setup local development. To use MongoDB Atlas, simply export `MONGODB_URI`:
```bash
export MONGODB_URI="mongodb+srv://<user>:<password>@cluster0.mongodb.net/quiz_platform?retryWrites=true&w=majority"
```

### 2. Frontend Setup & Launch
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server (defaults to http://localhost:3000)
npm run dev
```

### 3. Default Credentials
| Role | Identifier | Password | Access |
|---|---|---|---|
| **Host / Admin** | `admin` | `admin123` | Host Mission Control |
| **Team 1** | `TEAM001` | `pass123` | Quantum Voyagers |
| **Team 2** | `TEAM002` | `pass123` | Cyber Knights |
| **Team 3** | `TEAM003` | `pass123` | Binary Bandits |
| **Team 4** | `TEAM004` | `pass123` | Neural Ninjas |
| **Team 5** | `TEAM005` | `pass123` | Apex Legends |

---

## 🧪 100-Team Concurrency & Load Verification

The platform includes an automated simulation test tool that spins up 100 concurrent teams:
```bash
python backend/simulate_100_teams.py
```
This tests:
1. Batch CSV import of 100 teams (`SIM_001` to `SIM_100`).
2. Single-session enforcement (rejection of duplicate logins).
3. 100 simultaneous persistent Socket.IO connections.
4. Burst answer submissions on question open.
5. Automatic early reveal when all 100 teams answer.
6. Leaderboard ranking and tie-break validation.

---

## 📦 Deployment

### Backend (Render / Railway / Fly.io)
- **Runtime**: Python 3.11
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn -k eventlet -w 1 run:app` or `python run.py`
- **Environment Variables**:
  ```
  PORT=5000
  SECRET_KEY=your-secure-random-secret
  ADMIN_USERNAME=organizer
  ADMIN_PASSWORD=your-secure-admin-pass
  MONGODB_URI=mongodb+srv://...
  # Supabase Integration (Live Leaderboard & Marks Editor)
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=your-supabase-service-role-or-anon-key
  ```

### Supabase Table Setup (1-Click SQL)
Run [`supabase_leaderboard.sql`](./supabase_leaderboard.sql) in your Supabase SQL Editor:
```sql
CREATE TABLE IF NOT EXISTS public.leaderboard (
    quiz_id TEXT NOT NULL DEFAULT 'default_quiz',
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    marks NUMERIC NOT NULL DEFAULT 0,
    total_score NUMERIC NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    total_time_ms NUMERIC NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quiz_id, team_id)
);
```
- **Live Sync**: Whenever a question is scored, marks and ranks are auto-upserted to Supabase.
- **Manual Marks Edits**: You can edit marks/scores directly in Supabase's Table Editor. Click **"Pull from Supabase"** in the Admin Control Room (or call the sync endpoint) to immediately apply and broadcast changes to all live participant screens!


### Frontend (Vercel)

You can deploy the frontend to Vercel in seconds using either method:

#### Option A: Deploy Entire Repository (Root)
- **Framework Preset**: Vite
- **Root Directory**: `./` (Default root)
- Build command and output directory are automatically configured via [`vercel.json`](./vercel.json).

#### Option B: Deploy `frontend/` Subdirectory
- In your Vercel Project Settings, set **Root Directory** to `frontend`.
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

#### Vercel Environment Variables:
Add these in **Vercel Project Settings ➔ Environment Variables**:
| Variable | Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Deployed backend REST API base URL |
| `VITE_SOCKET_URL` | `https://your-backend.onrender.com` | Deployed Socket.IO WebSocket server URL |

*(If left blank during local testing, it defaults to the same-origin proxy).*

