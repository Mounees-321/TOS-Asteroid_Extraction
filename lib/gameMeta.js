import { db } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const META_REF = () => doc(db, "meta", "state");

// Live-subscribe to which game is currently active
export function subscribeActiveGame(callback) {
  return onSnapshot(META_REF(), (snap) => {
    callback(snap.exists() ? snap.data() : { activeGameId: null, gameCount: 0 });
  });
}

// Admin action: start a brand new round (this is also how Game 1 gets
// created — nothing auto-creates a game; the admin must click the
// button). Every asteroid's resource pool
// is fresh because it's a new empty teams subcollection under a new
// game doc — nothing carries over from the previous round.
export async function startNewGame() {
  const metaSnap = await getDoc(META_REF());
  const prevCount = metaSnap.exists() ? metaSnap.data().gameCount || 0 : 0;
  const newCount = prevCount + 1;
  const gameId = `game_${newCount}_${Date.now()}`;

  await setDoc(doc(db, "games", gameId), {
    label: `Game ${newCount}`,
    status: "building",
    createdAt: Date.now(),
    asteroidLog: [],
  });
  await setDoc(META_REF(), { activeGameId: gameId, gameCount: newCount }, { merge: true });
  return gameId;
}