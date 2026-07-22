"use client";

import { useEffect, useState } from "react";
import { GAME_CONFIG } from "../lib/gameConfig";
import { subscribeActiveGame } from "../lib/gameMeta";
import SpaceBackground from "../components/SpaceBackground";

export default function Home() {
  const [activeGameId, setActiveGameId] = useState(undefined); // undefined = still loading
  const [gameLabel, setGameLabel] = useState("");

  useEffect(() => {
    const unsub = subscribeActiveGame((meta) => {
      setActiveGameId(meta.activeGameId || null);
      setGameLabel(meta.gameCount ? `Game ${meta.gameCount}` : "");
    });
    return () => unsub();
  }, []);

  const gameOpen = !!activeGameId;

  return (
    <div>
      <SpaceBackground launching={false} />

      <div className="hero">
        <div className="hero-rocket">🚀</div>
        <h1 className="hero-title">TOURNAMENT OF STRATEGIES</h1>
        <p className="hero-sub">SYNDICATE EDITION — Arcade 2026</p>

        {activeGameId === undefined && (
          <p className="muted">Checking event status...</p>
        )}
        {activeGameId === null && (
          <div className="hero-cta-off">
            <p>No round is open yet. Wait for the admin to start one.</p>
          </div>
        )}
        {gameOpen && (
          <div className="hero-cta-on">
            <p className="muted">{gameLabel} is open for registration</p>
            <a href="/team" className="btn btn-lg">Register Your Team →</a>
          </div>
        )}
      </div>

      <div className="card">
        <p>
  Every syndicate gets <b>{GAME_CONFIG.starting_budget} Cr</b> to build
  up to <b>{GAME_CONFIG.max_ships_per_team} ships</b>. Spend on Engine
  Power, Cargo Capacity, and a blind Agency Bid — then race to the
  asteroid belt before your rivals mine it dry.

  <br />
  <br />

  The distance to the belt is <b>{GAME_CONFIG.distance_to_asteroids} light-years</b>,
  and each ship can travel <b>{GAME_CONFIG.ship_speed} 12 light-years per cycle</b>.
  Each asteroid has a value, weight, and decay rate — and the total pool of
  asteroids is limited. The team with the highest total earnings at the end of
  the round wins.
</p>
      </div>

      <div className="card">
        <h3>Asteroids</h3>
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

      <div className="card" style={{ textAlign: "center" }}>
        <a href="/leaderboard" className="btn secondary">View Live Leaderboard</a>
      </div>
    </div>
  );
}