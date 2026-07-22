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
