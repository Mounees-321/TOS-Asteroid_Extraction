"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, doc, onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
import { subscribeActiveGame, startNewGame } from "../../lib/gameMeta";
import { runSimulation } from "../../lib/gameConfig";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "ms_God_H";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");

  const [activeGameId, setActiveGameId] = useState(null);
  const [gameCount, setGameCount] = useState(0);
  const [gameDoc, setGameDoc] = useState({ status: "building", label: "" });
  const [teams, setTeams] = useState([]);
  const [busy, setBusy] = useState(false);

  // In-screen Modal States
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchPwInput, setLaunchPwInput] = useState("");
  const [launchError, setLaunchError] = useState("");

  // Keyboard navigation for "Start New Game" modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (showNewGameModal && e.key === "Enter" && !busy) {
        e.preventDefault();
        confirmStartNewGame();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showNewGameModal, busy]);

  // Keyboard navigation for "Launch & Resolve" modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (showLaunchModal && e.key === "Enter" && !busy) {
        e.preventDefault();
        confirmLaunchAndResolve();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLaunchModal, busy, launchPwInput]);

  useEffect(() => {
    if (sessionStorage.getItem("syndicate_admin") === "yes") setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const unsub = subscribeActiveGame((meta) => {
      setActiveGameId(meta.activeGameId);
      setGameCount(meta.gameCount || 0);
    });
    return () => unsub();
  }, [authed]);

  useEffect(() => {
    if (!authed || !activeGameId) return;
    const unsubGame = onSnapshot(doc(db, "games", activeGameId), (snap) => {
      if (snap.exists()) setGameDoc(snap.data());
    });
    const unsubTeams = onSnapshot(collection(db, "games", activeGameId, "teams"), (snap) => {
      setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubGame(); unsubTeams(); };
  }, [authed, activeGameId]);

  function login() {
    if (pwInput === ADMIN_PASSWORD) {
      sessionStorage.setItem("syndicate_admin", "yes");
      setAuthed(true);
    } else {
      alert("Wrong password.");
    }
  }

  async function confirmStartNewGame() {
    setShowNewGameModal(false);
    setBusy(true);
    await startNewGame();
    setBusy(false);
  }

  async function lockSubmissions() {
    await updateDoc(doc(db, "games", activeGameId), { status: "locked" });
  }

  async function reopenSubmissions() {
    await updateDoc(doc(db, "games", activeGameId), { status: "building" });
  }

  async function confirmLaunchAndResolve() {
    if (launchPwInput !== ADMIN_PASSWORD) {
      setLaunchError("Incorrect admin password.");
      return;
    }

    setLaunchError("");
    setShowLaunchModal(false);
    setLaunchPwInput("");
    setBusy(true);

    const rawTeams = teams
      .filter((t) => t.submitted)
      .map((t) => ({ name: t.name, ships: t.ships || [] }));

    const { leaderboard, asteroidLog } = runSimulation(rawTeams);

    const batch = writeBatch(db);
    for (const result of leaderboard) {
      const teamDoc = teams.find((t) => t.name === result.name);
      if (!teamDoc) continue;
      batch.update(doc(db, "games", activeGameId, "teams", teamDoc.id), {
        spent: result.spent,
        leftover: result.leftover,
        total_earnings: result.total_earnings,
        final_score: result.final_score,
      });
    }
    await batch.commit();

    await updateDoc(doc(db, "games", activeGameId), {
      status: "resolved",
      resolvedAt: Date.now(),
      asteroidLog,
    });

    setBusy(false);
  }

  if (!authed) {
    return (
      <div>
        <h1>Admin Login</h1>
        <div className="card" style={{ maxWidth: 360 }}>
          <label>Password</label>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <div style={{ height: 12 }} />
          <button className="btn" onClick={login}>Login</button>
        </div>
      </div>
    );
  }

  const submittedCount = teams.filter((t) => t.submitted).length;

  if (!activeGameId) {
    return (
      <div>
        <h1>Admin Dashboard</h1>
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🚀</div>
          <h2>No game running yet</h2>
          <p className="muted">
            Nothing is open for teams until you create the first round.
          </p>
          <button className="btn" onClick={() => setShowNewGameModal(true)} disabled={busy} style={{ marginTop: 12 }}>
            {busy ? "Creating..." : "Create Game 1"}
          </button>
        </div>

        {/* Modal: Start New Game */}
        {showNewGameModal && (
          <div style={modalOverlayStyle}>
            <div className="card" style={modalCardStyle}>
              <h2>➕ Start New Game Round?</h2>
              <p className="muted" style={{ margin: "16px 0" }}>
                This creates a brand new asteroid field. All teams will register fresh, and past results stay saved under <b>{gameDoc.label || "previous rounds"}</b>.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
                <button className="btn secondary" onClick={() => setShowNewGameModal(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="btn" onClick={confirmStartNewGame} disabled={busy} autoFocus>
                  {busy ? "Creating..." : "Create Round"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <div className="card row-between">
        <div>
          <p>Round: <b>{gameDoc.label || "..."}</b> (round #{gameCount})</p>
          <p>Status: <b>{gameDoc.status}</b></p>
        </div>
        <button className="btn secondary" onClick={() => setShowNewGameModal(true)} disabled={busy}>
          ➕ Start New Game
        </button>
      </div>

      <div className="card row-between">
        <p className="muted">{submittedCount} / {teams.length} teams submitted</p>
        <div style={{ display: "flex", gap: 10 }}>
          {gameDoc.status === "building" && (
            <button className="btn" onClick={lockSubmissions}>🔒 Lock Submissions</button>
          )}
          {gameDoc.status === "locked" && (
            <>
              <button className="btn secondary" onClick={reopenSubmissions}>Reopen</button>
              <button className="btn" onClick={() => { setLaunchError(""); setLaunchPwInput(""); setShowLaunchModal(true); }} disabled={busy}>
                {busy ? "Launching..." : "🚀 Launch & Resolve"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Teams</h3>
        <table>
          <thead>
            <tr>
              <th>Team</th><th>Crew</th><th>Ships</th><th>Spent</th><th>Leftover</th><th>Submitted</th>
              {gameDoc.status === "resolved" && <th>Final Score</th>}
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="muted">{(t.members || []).join(", ")}</td>
                <td>{(t.ships || []).length}</td>
                <td>{t.spent} Cr</td>
                <td>{t.leftover} Cr</td>
                <td>{t.submitted ? <span className="badge ok">✔</span> : <span className="badge warn">…</span>}</td>
                {gameDoc.status === "resolved" && <td><b>{t.final_score} Cr</b></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gameDoc.status === "resolved" && gameDoc.asteroidLog && (
        <div>
          <h2>Extraction Log — who got what</h2>
          {gameDoc.asteroidLog.map((a) => (
            <div className="card" key={a.asteroid}>
              <h3>{a.asteroid} <span className="muted">(pool {a.pool} tons, {a.remaining} left)</span></h3>
              {a.ships.length === 0 ? (
                <p className="muted">No ships targeted this asteroid.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Team</th><th>Ship</th><th>Bid</th><th>Launch</th><th>Transit</th>
                      <th>Arrival</th><th>Tons</th><th>Value/ton</th><th>Earnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.ships.map((s, i) => (
                      <tr key={i}>
                        <td>{s.team}</td><td>{s.ship_num}</td><td>{s.bid}</td>
                        <td>{s.launch_cycle}</td><td>{s.transit_time}</td><td>{s.arrival_cycle}</td>
                        <td>{s.tons}</td><td>{s.decayed_value}</td>
                        <td>
                          {s.earnings > 0
                            ? <span className="badge ok">{s.earnings} Cr</span>
                            : <span className="badge zero">Got nothing</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- In-Screen Modal: Start New Game --- */}
      {showNewGameModal && (
        <div style={modalOverlayStyle}>
          <div className="card" style={modalCardStyle}>
            <h2>➕ Start New Game Round?</h2>
            <p className="muted" style={{ margin: "16px 0" }}>
              This creates a brand new asteroid field. All teams will register fresh, and past results stay saved under <b>{gameDoc.label || "current round"}</b>.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button className="btn secondary" onClick={() => setShowNewGameModal(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn" onClick={confirmStartNewGame} disabled={busy} autoFocus>
                {busy ? "Creating..." : "Confirm & Start"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- In-Screen Modal: Launch & Resolve --- */}
      {showLaunchModal && (
        <div style={modalOverlayStyle}>
          <div className="card" style={modalCardStyle}>
            <h2>🚀 Launch Fleets & Resolve?</h2>
            <p className="muted" style={{ margin: "12px 0" }}>
              This will run fleet simulations and finalize scores for this round.
            </p>
            <div style={{ textAlign: "left", marginTop: 16 }}>
              <label>Enter Admin Password to Confirm</label>
              <input
                type="password"
                value={launchPwInput}
                onChange={(e) => setLaunchPwInput(e.target.value)}
                placeholder="Admin password"
                style={{ width: "100%", marginTop: 6 }}
                autoFocus
              />
              {launchError && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 6 }}>{launchError}</p>}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button className="btn secondary" onClick={() => setShowLaunchModal(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn" onClick={confirmLaunchAndResolve} disabled={busy}>
                {busy ? "Launching..." : "Confirm & Launch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles for modals
const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  backdropFilter: "blur(4px)",
};

const modalCardStyle = {
  maxWidth: 420,
  width: "90%",
  padding: 24,
  textAlign: "center",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
};