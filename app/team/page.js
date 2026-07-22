"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, setDoc, updateDoc, onSnapshot, collection } from "firebase/firestore";
import { subscribeActiveGame } from "../../lib/gameMeta";
import { GAME_CONFIG, calcShipCost } from "../../lib/gameConfig";

const emptyShip = () => ({ engine: 1, cargo: 1, bid: 0, target: 0 });

// A ship's build leans out of "balanced" once engine or cargo
// dominates the other — purely a readout, doesn't affect scoring.
function shipRole(engine, cargo) {
  const ratio = engine / Math.max(1, cargo);
  if (ratio >= 1.3) return { label: "Speed Runner", color: "var(--ion)" };
  if (ratio <= 0.6) return { label: "Heavy Hauler", color: "var(--ore)" };
  return { label: "Balanced Hull", color: "var(--success)" };
}

// Procedural ship silhouette
function ShipSilhouette({ engine, cargo, color }) {
  const flameLen = 10 + Math.min(26, engine * 0.42);
  const podCount = Math.min(4, Math.max(1, Math.round(cargo / 15)));
  const podR = 4 + Math.min(6, cargo * 0.09);
  return (
    <svg viewBox="0 0 120 60" className="ship-silhouette">
      <path
        d={`M18,30 L${18 - flameLen},24 L${18 - flameLen * 0.6},30 L${18 - flameLen},36 Z`}
        fill="var(--accent)"
        opacity="0.85"
        className="ship-flame"
      />
      <path d="M18,30 L70,18 Q95,22 108,30 Q95,38 70,42 Z" fill={color} opacity="0.9" />
      <path d="M70,18 Q95,22 108,30 Q95,38 70,42" fill="none" stroke="#0009" strokeWidth="1.5" />
      <circle cx="86" cy="30" r="4.5" fill="#0d111c" stroke="#ffffff55" strokeWidth="1" />
      {Array.from({ length: podCount }).map((_, i) => (
        <circle
          key={i}
          cx={38 + i * (podR * 2 + 4)}
          cy={30 - podR - 6}
          r={podR}
          fill="#0d111c"
          stroke={color}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

// Radial budget gauge
function BudgetGauge({ spent, total }) {
  const pct = Math.min(1, spent / total);
  const over = spent > total;
  const r = 26;
  const c = 2 * Math.PI * r;
  const ringColor = over ? "var(--danger)" : "var(--accent)";
  return (
    <div className="radial-gauge">
      <svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="#182034" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none"
          stroke={ringColor} strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.35s ease, stroke 0.2s ease" }}
        />
      </svg>
      <div>
        <div className="radial-gauge-label">Leftover</div>
        <div className="radial-gauge-value" style={{ color: over ? "var(--danger)" : "var(--ink)" }}>
          {Math.max(0, total - spent)} <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 12 }}>/ {total} Cr</span>
        </div>
      </div>
    </div>
  );
}

// Click-to-select asteroid target
function TargetSelector({ value, onChange, disabled }) {
  return (
    <div className="target-grid">
      {GAME_CONFIG.asteroids.map((a, idx) => {
        const selected = Number(value) === idx;
        return (
          <button
            key={a.name}
            type="button"
            disabled={disabled}
            onClick={() => onChange(idx)}
            className={`target-chip ${selected ? "selected" : ""}`}
          >
            <div className="target-chip-name">{a.name}</div>
            <div className="target-chip-value">{a.value}/t · pool {a.pool}t</div>
          </button>
        );
      })}
    </div>
  );
}

export default function TeamPage() {
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameStatus, setGameStatus] = useState("building");
  const [teamId, setTeamId] = useState(null);
  const [team, setTeam] = useState(null);

  // Join form state
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState([""]);
  const [joinError, setJoinError] = useState("");

  const [ships, setShips] = useState([emptyShip()]);
  const [saving, setSaving] = useState(false);

  // Modal confirmation state
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Keyboard navigation for submit modal (Press Enter to submit)
  useEffect(() => {
    function handleKeyDown(e) {
      if (showSubmitModal && e.key === "Enter" && !saving) {
        e.preventDefault();
        confirmSubmitFleet();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSubmitModal, saving, ships]);

  // Watch which game is active
  useEffect(() => {
    const unsub = subscribeActiveGame((meta) => setActiveGameId(meta.activeGameId));
    return () => unsub();
  }, []);

  // Watch that game's status
  useEffect(() => {
    if (!activeGameId) return;
    const unsub = onSnapshot(doc(db, "games", activeGameId), (snap) => {
      if (snap.exists()) setGameStatus(snap.data().status || "building");
    });
    return () => unsub();
  }, [activeGameId]);

  // Restore this browser's team for the CURRENT game
  useEffect(() => {
    if (!activeGameId) return;
    const savedId = localStorage.getItem(`syndicate_team_${activeGameId}`);
    setTeamId(savedId || null);
  }, [activeGameId]);

  useEffect(() => {
    if (!activeGameId || !teamId) return;
    const unsub = onSnapshot(
      doc(db, "games", activeGameId, "teams", teamId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTeam(data);
          if (data.ships && data.ships.length) setShips(data.ships);
        }
      }
    );
    return () => unsub();
  }, [activeGameId, teamId]);

  function updateMember(idx, value) {
    const updated = [...members];
    updated[idx] = value;
    setMembers(updated);
  }
  function addMember() {
    if (members.length >= 3) return;
    setMembers([...members, ""]);
  }
  function removeMember(idx) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  async function createTeam() {
    setJoinError("");
    const cleanMembers = members.map((m) => m.trim()).filter(Boolean);
    if (!teamName.trim()) return setJoinError("Enter a team name.");
    if (cleanMembers.length < 1) return setJoinError("Add at least 1 teammate name.");
    if (!activeGameId) return setJoinError("No active game round yet — ask the admin.");

    const teamsRef = collection(db, "games", activeGameId, "teams");
    const newDocRef = doc(teamsRef);
    await setDoc(newDocRef, {
      name: teamName.trim(),
      members: cleanMembers,
      ships: [emptyShip()],
      spent: 0,
      leftover: GAME_CONFIG.starting_budget,
      submitted: false,
      total_earnings: 0,
      final_score: 0,
      createdAt: Date.now(),
    });
    localStorage.setItem(`syndicate_team_${activeGameId}`, newDocRef.id);
    setTeamId(newDocRef.id);
  }

  function updateShip(idx, field, value) {
    const updated = [...ships];
    updated[idx] = { ...updated[idx], [field]: Number(value) };
    setShips(updated);
  }
  function addShip() {
    if (ships.length >= GAME_CONFIG.max_ships_per_team) return;
    setShips([...ships, emptyShip()]);
  }
  function removeShip(idx) {
    setShips(ships.filter((_, i) => i !== idx));
  }

  const totalSpent = ships.reduce((sum, s) => sum + calcShipCost(s.engine, s.cargo, s.bid), 0);
  const leftover = GAME_CONFIG.starting_budget - totalSpent;
  const overBudget = leftover < 0;

  async function saveDraft() {
    if (!teamId) return;
    setSaving(true);
    await updateDoc(doc(db, "games", activeGameId, "teams", teamId), {
      ships, spent: totalSpent, leftover,
    });
    setSaving(false);
  }

  async function confirmSubmitFleet() {
    if (overBudget) return alert("You are over budget!");
    setShowSubmitModal(false);
    setSaving(true);
    await updateDoc(doc(db, "games", activeGameId, "teams", teamId), {
      ships, spent: totalSpent, leftover, submitted: true,
    });
    setSaving(false);
  }

  // ---------- RENDER ----------

  if (!activeGameId) {
    return <div className="card">Waiting for admin to start a game round...</div>;
  }

  if (!teamId) {
    return (
      <div>
        <h1>Register Your Team</h1>
        <div className="card" style={{ maxWidth: 460 }}>
          <label>Team Name</label>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          <div style={{ height: 14 }} />
          <label>Teammates (1 to 3 people)</label>
          {members.map((m, idx) => (
            <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={m}
                placeholder={`Teammate ${idx + 1} name`}
                onChange={(e) => updateMember(idx, e.target.value)}
              />
              {members.length > 1 && (
                <button className="btn secondary" onClick={() => removeMember(idx)}>✕</button>
              )}
            </div>
          ))}
          {members.length < 3 && (
            <button className="btn secondary" onClick={addMember}>+ Add teammate</button>
          )}
          <div style={{ height: 16 }} />
          <button className="btn" onClick={createTeam}>Continue →</button>
          {joinError && <p style={{ color: "#f87171" }}>{joinError}</p>}
        </div>
      </div>
    );
  }

  const locked = gameStatus !== "building" || (team && team.submitted);

  return (
    <div>
      <h1>{team?.name || "Your Fleet"}</h1>
      {team?.members && (
        <p className="muted">Crew: {team.members.join(", ")}</p>
      )}

      {gameStatus !== "building" && !team?.submitted && (
        <div className="card" style={{ borderColor: "#ef4444" }}>
          Submissions are closed. This fleet won't be scored.
        </div>
      )}
      {team?.submitted && (
        <div className="card" style={{ borderColor: "#4ade80" }}>
          ✅ Fleet submitted and locked. Watch the <a href="/leaderboard">leaderboard</a> after launch.
        </div>
      )}

      <div className="card row-between">
        <BudgetGauge spent={totalSpent} total={GAME_CONFIG.starting_budget} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="budget-bar-bg">
            <div className="budget-bar-fill" style={{
              width: `${Math.min(100, (totalSpent / GAME_CONFIG.starting_budget) * 100)}%`,
              background: overBudget ? "#ef4444" : "#ffd166",
            }} />
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Spent {totalSpent} Cr of {GAME_CONFIG.starting_budget} Cr
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Asteroids</h3>
        <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
          Distance: 12 light-years
        </p>
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Value/ton</th><th>Weight/ton</th><th>Decay/cycle</th><th>Pool</th>
            </tr>
          </thead>
          <tbody>
            {GAME_CONFIG.asteroids.map((a) => (
              <tr key={a.name}>
                <td>{a.name}</td><td>{a.value}</td><td>{a.weight}</td>
                <td>{a.stability}</td><td>{a.pool} tons</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ships.map((s, idx) => {
        const cost = calcShipCost(s.engine, s.cargo, s.bid);
        const role = shipRole(s.engine, s.cargo);
        return (
          <div className="card" key={idx}>
            <div className="row-between">
              <h3>Ship {idx + 1}</h3>
              {!locked && ships.length > 1 && (
                <button className="btn secondary" onClick={() => removeShip(idx)}>Remove</button>
              )}
            </div>

            <div className="ship-config-grid">
              <div>
                <ShipSilhouette engine={s.engine} cargo={s.cargo} color={role.color} />
                <div className="ship-id">Ship {idx + 1}</div>
                <div
                  className="role-badge"
                  style={{ color: role.color, border: `1px solid ${role.color}`, background: "transparent" }}
                >
                  {role.label}
                </div>
                <div className="ship-build-cost">Build: {cost} Cr</div>
              </div>

              <div>
                <div className="slider-row">
                  <div className="slider-row-label">
                    <span>Engine Power <b>{s.engine}u</b></span>
                    <span className="slider-row-cost">{s.engine * GAME_CONFIG.engine_cost_per_unit} Cr</span>
                  </div>
                  <input
                    type="range" min={1} max={12} disabled={locked}
                    value={s.engine} className="track-ion"
                    onChange={(e) => updateShip(idx, "engine", e.target.value)}
                  />
                </div>
                <div className="slider-row">
                  <div className="slider-row-label">
                    <span>Cargo Capacity <b>{s.cargo}u</b></span>
                    <span className="slider-row-cost">{s.cargo * GAME_CONFIG.cargo_cost_per_unit} Cr</span>
                  </div>
                  <input
                    type="range" min={0} max={120} disabled={locked}
                    value={s.cargo} className="track-ore"
                    onChange={(e) => updateShip(idx, "cargo", e.target.value)}
                  />
                </div>
                <div className="slider-row sealed-wrap">
                  <label>Agency Bid ({GAME_CONFIG.bid_cost_per_unit} Cr/unit)</label>
                  <span className="sealed-tag">🔒 sealed</span>
                  <input
                    type="number" min={0} disabled={locked} value={s.bid}
                    onChange={(e) => updateShip(idx, "bid", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label>Target Asteroid</label>
                <TargetSelector
                  value={s.target}
                  disabled={locked}
                  onChange={(v) => updateShip(idx, "target", v)}
                />
              </div>
            </div>
          </div>
        );
      })}

      {!locked && ships.length < GAME_CONFIG.max_ships_per_team && (
        <button className="btn secondary" onClick={addShip}>+ Add Ship</button>
      )}

      {!locked && (
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button className="btn secondary" onClick={saveDraft} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            className="btn"
            onClick={() => setShowSubmitModal(true)}
            disabled={saving || overBudget}
          >
            Submit Final Fleet
          </button>
        </div>
      )}

      {/* --- In-Screen Modal Confirmation Pop-Up --- */}
      {showSubmitModal && (
        <div
          style={{
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
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 420,
              width: "90%",
              padding: 24,
              textAlign: "center",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>🚀 Submit Fleet?</h2>
            <p className="muted" style={{ margin: "16px 0" }}>
              Are you sure you want to submit your fleet? You will <b>not</b> be able to edit your ships or bids after submitting.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                className="btn secondary"
                onClick={() => setShowSubmitModal(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={confirmSubmitFleet}
                disabled={saving}
                autoFocus
              >
                {saving ? "Submitting..." : "Yes, Submit Fleet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}