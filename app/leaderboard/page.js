"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, doc, query, orderBy, getDocs } from "firebase/firestore";
import { subscribeActiveGame } from "../../lib/gameMeta";
import SpaceBackground from "../../components/SpaceBackground";

export default function LeaderboardPage() {
  const [activeGameId, setActiveGameId] = useState(null);
  const [activeGameLabel, setActiveGameLabel] = useState("");
  const [activeGameStatus, setActiveGameStatus] = useState("building");
  const [showLaunchFx, setShowLaunchFx] = useState(false);
  
  // Historical & All Games State
  const [allGames, setAllGames] = useState([]); // List of all game objects with their teams
  const [selectedGameId, setSelectedGameId] = useState(null); // Currently selected tab/round
  const [roundWinners, setRoundWinners] = useState([]);
  const [dominator, setDominator] = useState(null);

  const prevStatus = useRef("building");

  // Fetch active game meta
  useEffect(() => {
    const unsub = subscribeActiveGame((meta) => setActiveGameId(meta.activeGameId));
    return () => unsub();
  }, []);

  // Fetch active game details (for status badge & launch FX)
  useEffect(() => {
    if (!activeGameId) return;
    const unsubGame = onSnapshot(doc(db, "games", activeGameId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setActiveGameLabel(data.label || "Live Game");
      setActiveGameStatus(data.status || "building");

      if (data.status === "resolved" && prevStatus.current !== "resolved") {
        setShowLaunchFx(true);
        setTimeout(() => setShowLaunchFx(false), 2600);
      }
      prevStatus.current = data.status;
    });

    return () => unsubGame();
  }, [activeGameId]);

  // Fetch ALL games and their teams dynamically
  useEffect(() => {
    const unsubGames = onSnapshot(collection(db, "games"), async (snapshot) => {
      const gamesList = [];
      const winnersList = [];
      const statsMap = {};

      for (const gameDoc of snapshot.docs) {
        const gameData = gameDoc.data();
        const teamsQuery = query(
          collection(db, "games", gameDoc.id, "teams"),
          orderBy("final_score", "desc")
        );
        const teamSnap = await getDocs(teamsQuery);
        const teams = teamSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const gameObj = {
          id: gameDoc.id,
          label: gameData.label || `Game ${gameDoc.id.slice(0, 5)}`,
          status: gameData.status || "building",
          teams,
        };

        gamesList.push(gameObj);

        // Process resolved game results
        if (gameData.status === "resolved" && teams.length > 0) {
          const winnerData = teams[0];
          const runnerUpData = teams[1];

          winnersList.push({
            roundName: gameObj.label,
            winnerName: winnerData?.name || "N/A",
            winnerScore: winnerData?.final_score || 0,
            winnerMembers: winnerData?.members || [],
            runnerUpName: runnerUpData?.name || "N/A",
            runnerUpScore: runnerUpData?.final_score || 0,
            runnerUpMembers: runnerUpData?.members || [],
          });

          // Accumulate overall tournament stats
          teams.forEach((t) => {
            if (!statsMap[t.name]) {
              statsMap[t.name] = { wins: 0, totalScore: 0, members: t.members || [] };
            }
            statsMap[t.name].totalScore += t.final_score || 0;
          });

          if (winnerData?.name) {
            statsMap[winnerData.name].wins += 1;
          }
        }
      }

      setAllGames(gamesList);
      setRoundWinners(winnersList);

      // Default selected tab to current active game or first game if not set
      setSelectedGameId((prev) => prev || activeGameId || (gamesList[0]?.id ?? null));

      // Determine Dominating Team
      const rankedTeams = Object.entries(statsMap).map(([name, stats]) => ({
        name,
        ...stats,
      }));
      rankedTeams.sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore);

      setDominator(rankedTeams.length > 0 ? rankedTeams[0] : null);
    });

    return () => unsubGames();
  }, [activeGameId, activeGameStatus]);

  // Selected game data
  const currentGame = allGames.find((g) => g.id === (selectedGameId || activeGameId)) || {
    label: activeGameLabel,
    status: activeGameStatus,
    teams: [],
  };

  const isCurrentResolved = currentGame.status === "resolved";

  return (
    <div>
      <SpaceBackground launching={showLaunchFx} />

      <h1>🏆 Leaderboard {currentGame.label && `— ${currentGame.label}`}</h1>

      {/* --- Round Selection Tabs --- */}
      {allGames.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {allGames.map((g) => {
            const isSelected = g.id === (selectedGameId || activeGameId);
            const isActive = g.id === activeGameId;
            return (
              <button
                key={g.id}
                className={`btn ${isSelected ? "" : "secondary"}`}
                onClick={() => setSelectedGameId(g.id)}
                style={{ padding: "6px 14px", fontSize: 14 }}
              >
                {g.label} {isActive ? "🟢 (Live)" : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Status Banner --- */}
      <div className="card">
        <span className="badge ok">
          {currentGame.status === "building" && "Fleets are being built..."}
          {currentGame.status === "locked" && "Submissions locked — awaiting launch"}
          {currentGame.status === "resolved" && "Resolved!"}
        </span>
      </div>

      {/* --- Team Leaderboard Table for Selected Game --- */}
      <div className="card">
        <h3>{currentGame.label} Rankings</h3>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Crew</th>
              {isCurrentResolved && <><th>Cargo Earnings</th><th>Leftover</th></>}
              <th>{isCurrentResolved ? "Final Score" : "Submitted"}</th>
            </tr>
          </thead>
          <tbody>
            {currentGame.teams.length === 0 ? (
              <tr>
                <td colSpan={isCurrentResolved ? 6 : 4} className="muted" style={{ textAlign: "center" }}>
                  No teams registered for this round yet.
                </td>
              </tr>
            ) : (
              currentGame.teams.map((t, i) => (
                <tr key={t.id || i}>
                  <td>{isCurrentResolved ? i + 1 : "—"}</td>
                  <td>{t.name}</td>
                  <td className="muted">{(t.members || []).join(", ")}</td>
                  {isCurrentResolved && <><td>{t.total_earnings} Cr</td><td>{t.leftover} Cr</td></>}
                  <td>
                    {isCurrentResolved ? (
                      <b>{t.final_score} Cr</b>
                    ) : t.submitted ? (
                      <span className="badge ok">✔ Submitted</span>
                    ) : (
                      <span className="badge warn">Building...</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Selected Round Podium (Winner & Runner-Up) --- */}
      {isCurrentResolved && currentGame.teams.length > 0 && (
        <div className="card" style={{ textAlign: "center" }}>
          <h2>🥇 Round Winner: {currentGame.teams[0].name} ({currentGame.teams[0].final_score} Cr)</h2>
          <p className="muted">{(currentGame.teams[0].members || []).join(", ")}</p>

          {currentGame.teams.length > 1 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <h3>🥈 Runner-Up: {currentGame.teams[1].name} ({currentGame.teams[1].final_score} Cr)</h3>
              <p className="muted">{(currentGame.teams[1].members || []).join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {/* --- Overall Dominating Team Banner --- */}
      {dominator && (
        <div className="card" style={{ textAlign: "center", borderColor: "var(--accent)" }}>
          <h2>👑 CURRENT TOURNAMENT DOMINATOR 👑</h2>
          <h1 style={{ margin: "10px 0", color: "var(--accent)" }}>{dominator.name}</h1>
          <p className="muted">{dominator.members.join(", ")}</p>
          <p style={{ fontWeight: "bold" }}>
            Total Victories: {dominator.wins} | Cumulative Score: {dominator.totalScore} Cr
          </p>
        </div>
      )}

      {/* --- Round-by-Round Victories & Runners-Up Summary --- */}
      {roundWinners.length > 0 && (
        <div className="card">
          <h3>🎮 Round History & Podium Summary</h3>
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>🥇 Winner</th>
                <th>Score</th>
                <th>🥈 Runner-Up</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {roundWinners.map((w, idx) => (
                <tr key={idx}>
                  <td><b>{w.roundName}</b></td>
                  <td>{w.winnerName}</td>
                  <td><b>{w.winnerScore} Cr</b></td>
                  <td>{w.runnerUpName}</td>
                  <td>{w.runnerUpScore ? `${w.runnerUpScore} Cr` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}