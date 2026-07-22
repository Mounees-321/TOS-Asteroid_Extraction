<<<<<<< HEAD
# Syndicate Edition — Setup & Deploy

## 1. Firebase (database) setup

1. Go to https://console.firebase.google.com → **Add project** (free) → name it anything, e.g. `syndicate-edition`.
2. In the left sidebar: **Build → Firestore Database → Create database**.
   - Choose a region close to you (e.g. `asia-south1` for India).
   - Start in **test mode** (you'll paste real rules in step 4 below).
3. Get your web config: gear icon (top left) → **Project settings** → scroll to
   **"Your apps"** → click the **`</>`** (Web) icon → register app (no need for
   Firebase Hosting) → copy the `firebaseConfig` values shown.
4. Go to **Firestore Database → Rules** tab, delete the default content, and
   paste in the contents of `firestore.rules` (included in this project).
   Click **Publish**.
5. That's it — no Cloud Functions, no servers. Firestore is your entire backend.

## 2. Fill in your environment variables

Copy `.env.local.example` to `.env.local` and fill in the values from step 3 above:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_ADMIN_PASSWORD=pick_something_only_you_know
```

## 3. Test locally (optional but recommended)

```bash
npm install
npm run dev
```
Visit `http://localhost:3000`, then `http://localhost:3000/admin` to create Game 1
and confirm everything writes to Firestore correctly before the real event.

## 4. Deploy to Vercel (free)

1. Push this project to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Syndicate Edition"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Go to https://vercel.com → sign in with GitHub → **Add New → Project** →
   import your repo.
3. Before clicking Deploy, open **Environment Variables** and add every value
   from your `.env.local` (same names, same values).
4. Click **Deploy**. You'll get a live URL like `syndicate-edition.vercel.app`
   in about a minute.

## 5. Run the event

- Share `https://your-app.vercel.app/team` with students to register + build fleets.
- Project `https://your-app.vercel.app/leaderboard` on the big screen.
- You control everything from `https://your-app.vercel.app/admin`:
  1. Click **Create Game 1** — this opens registration for everyone.
  2. Watch teams submit live.
  3. Click **Lock Submissions** when time's up.
  4. Click **🚀 Launch & Resolve** — leaderboard updates instantly everywhere,
     with the rocket-launch animation playing on the projected screen.
  5. When ready for another round, click **Start New Game** — resources reset
     automatically since it's a brand new round.

## Free tier limits (you won't come close)

- **Vercel Hobby**: 100 GB bandwidth/month, unlimited deploys.
- **Firestore Spark (free)**: 50K reads / 20K writes / 20K deletes per day,
  1 GiB storage. A college event with dozens of teams uses a tiny fraction of this.

## Known limitation

The admin password check is client-side only (see `firestore.rules` for the
full note). Fine for a casual college event; if you want it airtight, add real
Firebase Authentication for the admin account — ask and I'll wire it up.
=======
# TOS-Asteroid_Extraction
# 🛰️ Syndicate: Asteroid Extraction Directive

**Tournament of Strategies — Arcade Edition (2026)**

A single-file, browser-based strategy game. Direct a planetary extraction syndicate with a fixed 1,000 Credit budget, build a fleet of mining ships, bid for launch slots, and race decaying resources back to Earth before your rivals do.

No install, no build step, no dependencies — open the HTML file and play.

---

## 🎮 Play

Open [`syndicate-of-strategies.html`](./syndicate-of-strategies.html) directly in any modern browser, or serve the repo locally:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit the file in your browser.

---

## 📋 How It Works

### 1. Briefing
Study the manifest of 5 charted asteroids before committing budget. Each claim has:

| Property | Meaning |
|---|---|
| **Value / ton** | Base Credits earned per ton mined |
| **Weight / ton** | Cargo Capacity required to hold 1 ton |
| **Decay / cycle** | Value lost per ton for every cycle spent on the *return* leg |
| **Pool** | Total tons available on that claim (shared across all syndicates) |

### 2. Shipyard
Spend your 1,000 Cr across up to 5 ships. Each ship needs:

- **Engine Power** — 10 Cr/unit. Transit time = `ceil(12 / engine)` cycles, each way.
- **Cargo Capacity** — 10 Cr/unit. Tons held = `cargo ÷ claim weight`.
- **Agency Bid** — 1 Cr/point. Determines launch order per claim (highest bid launches Cycle 1, next-highest Cycle 2, etc.). Ties break on Engine Power, then Cargo Capacity.

Unspent Credits carry into your final score — **at 50% value**. Cash is a hedge, not a strategy.

### 3. Launch Control
Bids resolve into a launch schedule. Because faster ships can be launched later and still arrive first, **overtaking** is core to the game — a low-bid, high-engine ship can beat a high-bid, slow ship to the claim and mine it out from under them.

### 4. Settlement
Once a ship arrives, it mines instantly: fills its hold up to capacity or until the claim is exhausted, then begins the return trip. Return-trip decay is applied per ton:

```
final value/ton = max(0, base value − decay/cycle × transit cycles)
ship earnings   = tons mined × final value/ton
```

Final score = total earnings (after decay) + 50% of unspent budget. Compete against two AI-controlled rival syndicates that build and bid their own fleets each run.

---

## 🧠 Strategic Tensions

- **Speed vs. cargo vs. bid** — a fast, empty-handed ship arrives first but might not out-mine a slower ship with a bigger hold.
- **Contested vs. quiet claims** — high-value claims (e.g. Kryll's Comet) attract competition and decay fast; stable low-value claims (e.g. Draconis Field) are safer but less lucrative.
- **Overtaking** — bidding highest doesn't guarantee arriving first if your engine is weak.
- **Hoarding vs. investing** — unspent Credits are safe but discounted; a syndicate that never launches can't win outright.

---

## 🛠️ Tech

- Single self-contained `.html` file — vanilla JavaScript, no framework, no build tooling.
- No external runtime dependencies beyond Google Fonts (Big Shoulders Display, Inter, JetBrains Mono), loaded via CDN.
- All game logic (bidding, transit, overtaking, decay, scoring) lives in one `<script>` block for easy reading and modification.

---

## 📁 Repo Structure

```
.
├── syndicate-of-strategies.html   # the entire game
└── README.md
```

---

## ✏️ Customizing

All tunable game data lives at the top of the `<script>` block:

- `ASTEROIDS` — add, remove, or rebalance claims (value/weight/decay/pool).
- `BUDGET`, `MAX_SHIPS`, `DISTANCE` — core constants.
- `BOT_NAMES` / `genBotFleet()` — rival syndicate count and AI budgeting behavior.
- Leftover-credit multiplier (currently `0.5`) — set inside `runGame()`.

---

## 📄 License

MIT — do whatever you want with it.
>>>>>>> 6bf052ddd05d1b49baecb78bfb1615fdc25a4b8e
