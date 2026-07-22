import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";

// Fill these in from your Firebase project settings (or use env vars below).
// Project Settings -> General -> "Your apps" -> Web app -> SDK config.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "sender-id",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "app-id"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// experimentalAutoDetectLongPolling: fixes "client is offline" errors on
// networks (college wifi, antivirus, some VPNs/proxies) that block
// Firestore's normal streaming connection — falls back to long-polling
// automatically without needing to force it everywhere.
// Wrapped in try/catch because initializeFirestore can only run once per
// app — on Next.js dev hot-reload it may already be initialized, in which
// case we just grab the existing instance instead.
let db;
try {
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
} catch (e) {
  db = getFirestore(app);
}
export { db };