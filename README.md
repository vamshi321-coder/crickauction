# 🏏 CrickAuction

> A real-time multiplayer IPL-style cricket auction simulator — play with friends and intelligent franchise bots.

**Modified by Vamshi Nakkala** | Original by Shaurya Upadhyay

---

## 🚀 Live Demo

🌐 [cricketauction3.vercel.app](https://cricketauction3.vercel.app)

---

## 🎮 What Is This?

CrickAuction is a multiplayer browser-based IPL auction simulator where:
- Up to 10 teams can join a live auction room
- A host controls the auction flow
- Participants bid on real IPL players in real time
- Empty team slots are filled by intelligent franchise owner bots
- After the auction, teams can play Fantasy XI and simulate Dream Matches

Built with **React + Firebase Realtime Database** for true multiplayer synchronization.

---

## ✨ Features

### 🏟️ Live Multiplayer Auction
- Real-time bidding synced across all devices via Firebase RTDB
- Host controls: Start, Pause, Resume, Next Player, SOLD/UNSOLD
- Countdown timer with 4-second warning sound
- Team songs play on SOLD for all connected participants
- Sound ON/OFF toggle per participant
- Player card flip reveal animation when a new player enters
- Set announcement banner (Marquee Set 1 → Set 1 → Set 2...)
- Players randomized within each set — set order stays fixed

### 🤖 Realistic Franchise Bot Engine (v6.7)
- Empty team slots are automatically controlled by franchise owner bots
- **10 unique franchise personalities** — each based on real IPL owners:
  - Mukesh Ambani (MI) — Aggressive spender
  - Virat Kohli XI (RCB) — Star hunter, chases elite batsmen
  - Shah Rukh Khan (KKR) — Unpredictable, dramatic bids
  - N. Srinivasan (CSK) — Balanced, prefers experienced players
  - Parth Jindal (DC) — Data-driven, never overpays
  - Preity Zinta (PBKS) — Squad-need driven
  - Manoj Badale (RR) — Value hunter, buys at discount
  - Kalanithi Maran (SRH) — Aggressive on bowlers
  - CVC Capital (GT) — Balanced conservative
  - Sanjiv Goenka (LSG) — Squad-need driven
- **Dynamic per-player valuation** — each bot calculates a unique max price per player based on:
  - Player quality rating (from real stats)
  - Role priority per franchise
  - Squad gaps and role needs
  - Remaining purse and budget management
  - Future player planning (looks ahead 40 players)
  - Name/player affinity (RCB bids harder on Kohli-type players)
  - Experience preference
  - Personality-based random variance
- **Banded price tiers** — realistic IPL price distribution:
  - Elite players (Kohli, Bumrah level) → ₹15–22 Cr
  - Quality players → ₹7–15 Cr
  - Good players → ₹3–7 Cr
  - Average players → ₹1.2–3 Cr
  - Backups/uncapped → ₹0.3–1 Cr
- Bots wait 3–10 seconds before bidding (feels human)
- Bot engine restarts automatically if host refreshes mid-auction

### 🏆 Fantasy Section
- **Best Team** — rates your complete auction squad using real player stats
- **Select Play XI** — pick your playing 11 from your squad, assign Captain & Vice-Captain
- **Leaderboard** — ranks all participants by their Play XI rating (no manual points needed)
- Rating engine is role-aware: batsmen rated on runs/avg/SR, bowlers on wickets/economy

### 📊 Compare Teams
- Side-by-side squad comparison for any two teams
- Shows: player count, squad rating, total spent, overseas count, role breakdown
- Full player list with photos and bid prices

### 🏏 Dream Match Simulator
- Simulate T20 or ODI matches between any two squads
- Over-by-over run chart, top scorer, top bowler
- Full batting and bowling scorecards
- Seeded random — same matchup gives consistent results
- Quick matchup shortcuts for all possible team combinations

### 🎯 Bid Prediction Mini-Game
- Before each player's auction, predict the final sold price
- After SOLD, closest prediction is revealed with rankings
- Synced across all participants in the room via Firebase

### 📖 Onboarding Guide
- Step-by-step coach-mark tour appears after auction starts
- Highlights real UI elements with spotlight and arrow tooltip
- Skippable, remembers completion per device

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| 3D / Visual | Three.js (canvas-confetti for effects) |
| Database | Firebase Realtime Database |
| Auth | Firebase Anonymous Auth |
| Deployment | Vercel |
| Icons | Lucide React |

---

## ⚙️ Setup & Running Locally

### Prerequisites
- Node.js 18+
- A Firebase project (free Spark plan works)

### 1. Clone the repo
```bash
git clone https://github.com/vamshi321-coder/crickauction.git
cd crickauction/ipl-auction-main
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create `.env` file
Copy `.env.example` to `.env` and fill in your Firebase config:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.region.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Firebase setup required
In your Firebase console, enable:
- **Authentication** → Anonymous sign-in
- **Firestore Database** → Start in test mode
- **Realtime Database** → Start in test mode

### 5. Run locally
```bash
npm run dev
```
Open `http://localhost:5173`

---

## 🎯 How to Play

1. Open the site and create an auction room
2. Share the room code with friends
3. Each friend picks an IPL franchise
4. Empty team slots become intelligent bots (franchise owner personalities)
5. Host clicks **Start Auction** — players come up set by set
6. Bid on players before the timer runs out
7. After auction ends, pick your **Fantasy XI** and simulate **Dream Matches**

---

## 📁 Project Structure

```
src/
├── components/
│   ├── fantasy/          # Best Team, Play XI, Leaderboard
│   ├── BidPrediction.jsx # Prediction mini-game
│   ├── DreamMatch.jsx    # Match simulator UI
│   ├── OnboardingGuide.jsx # Coach-mark tour
│   └── TextChat.jsx      # In-room chat
├── contexts/
│   └── AuctionContext.jsx # All Firebase sync + bot engine wiring
├── data/
│   ├── players.js        # 523 IPL players with stats
│   └── teams.js          # 10 IPL franchises
├── lib/
│   ├── botEngine.js      # Franchise bot AI engine
│   ├── matchSimulator.js # T20/ODI match simulation
│   ├── playerRating.js   # Role-aware player rating system
│   └── firebase.js       # Firebase config
└── pages/
    ├── AuctionRoom.jsx   # Main auction UI
    ├── AuctionSummary.jsx # Post-auction tabs
    ├── LandingPage.jsx   # Home page
    └── Lobby.jsx         # Pre-auction lobby
```

---

## 🔒 Privacy

This project is for **personal use between friends only**.
- Not publicly listed or indexed
- No monetization
- IPL player data used for educational/entertainment purposes only

---

## 📝 Version History

| Version | What Changed |
|---|---|
| v1 | Initial project (Shaurya Upadhyay) |
| v2 | Firebase integration, .env setup, basic auction working |
| v3 | Best Team rating, Leaderboard, Squad Comparison, Player card flip animation, Set announcements |
| v4 | Audio ON/OFF toggle, set-wise player randomization, Modified by footer |
| v5 | TTS/voice removed, Dream Match simulator, Bid Prediction, Onboarding guide |
| v6 | Franchise bot engine — 10 personalities, Firebase transactions, host refresh fix |
| v6.3 | Countdown timer sound at 4 seconds |
| v6.6 | Full dynamic valuation engine — banded pricing, future planning, squad need |
| v6.7 | Realistic price tiers, scaled bid increments, improved name affinities |
