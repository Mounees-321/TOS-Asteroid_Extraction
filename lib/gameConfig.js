// ============================================================
// GAME CONFIG + RESOLUTION ENGINE
// Single source of truth — imported by the admin dashboard
// (and later, by the Cloud Function backend, so the logic
// never has to be duplicated).
// ============================================================

export const GAME_CONFIG = {
  starting_budget: 1000,
  max_ships_per_team: 5,
  engine_cost_per_unit: 10,
  cargo_cost_per_unit: 3,
  bid_cost_per_unit: 2,
  distance: 12,
  asteroids: [
    { name: "Vesta-9", value: 10, weight: 2, stability: 2, pool: 50 },
    { name: "Ceres-Prime", value: 15, weight: 3, stability: 3, pool: 40 },
    { name: "Pallas-Rim", value: 8, weight: 1, stability: 1, pool: 60 },
    { name: "Hygiea-Deep", value: 20, weight: 4, stability: 4, pool: 30 },
    { name: "Interamnia-Belt", value: 12, weight: 2, stability: 2, pool: 45 },
  ],
};

export function calcShipCost(engine, cargo, bid) {
  return (
    engine * GAME_CONFIG.engine_cost_per_unit +
    cargo * GAME_CONFIG.cargo_cost_per_unit +
    bid * GAME_CONFIG.bid_cost_per_unit
  );
}

/**
 * rawTeams: [{ name, ships: [{engine, cargo, bid, target}] }]
 * Returns: { leaderboard, shipLog }
 *   leaderboard: per-team totals, sorted by final_score desc
 *   shipLog: every ship with its full resolved outcome (for the
 *            admin "who got what" view, grouped by asteroid)
 */
export function runSimulation(rawTeams) {
  const teams = [];
  const allShips = [];

  for (const team of rawTeams) {
    const teamName = team.name;
    const rawShips = team.ships || [];
    let totalSpent = 0;

    rawShips.forEach((s, idx) => {
      const engine = Math.max(1, s.engine || 1);
      const cargo = s.cargo || 0;
      const bid = s.bid || 0;
      const target = s.target || 0;
      const cost = calcShipCost(engine, cargo, bid);
      totalSpent += cost;

      allShips.push({
        team: teamName,
        ship_num: idx + 1,
        engine,
        cargo,
        bid,
        target,
        cost,
        earnings: 0,
        tons: 0,
        transit_time: null,
        arrival_cycle: null,
        launch_cycle: null,
        decayed_value: null,
      });
    });

    const leftover = GAME_CONFIG.starting_budget - totalSpent;
    teams.push({
      name: teamName,
      spent: totalSpent,
      leftover,
      total_earnings: 0,
      final_score: 0,
    });
  }

  const asteroidLog = GAME_CONFIG.asteroids.map((asteroid, aIdx) => {
    const shipsHere = allShips.filter((s) => s.target === aIdx);
    let remainingPool = asteroid.pool;

    if (shipsHere.length > 0) {
      // Assign ONE stable random tiebreak per ship, generated once,
      // reused across every comparison. Calling Math.random() fresh
      // inside a sort comparator is a bug: sort() assumes comparing
      // the same pair twice gives the same answer, and a comparator
      // that returns a different result each time can silently
      // produce an incorrectly ordered array, not just a "random tie".
      shipsHere.forEach((s) => { s._tiebreak = Math.random(); });

      // Launch order: highest bid -> engine -> cargo -> stable random
      shipsHere.sort(
        (a, b) =>
          b.bid - a.bid ||
          b.engine - a.engine ||
          b.cargo - a.cargo ||
          a._tiebreak - b._tiebreak
      );
      shipsHere.forEach((s, i) => {
        s.launch_cycle = i + 1;
        s.transit_time = Math.ceil(GAME_CONFIG.distance / s.engine);
        s.arrival_cycle = s.launch_cycle + s.transit_time;
      });

      // Extraction order: earliest arrival -> engine -> cargo -> stable random
      shipsHere.sort(
        (a, b) =>
          a.arrival_cycle - b.arrival_cycle ||
          b.engine - a.engine ||
          b.cargo - a.cargo ||
          a._tiebreak - b._tiebreak
      );

      for (const s of shipsHere) {
        const maxTons = Math.floor(s.cargo / asteroid.weight);
        const tons = Math.min(maxTons, remainingPool);
        remainingPool -= tons;
        const decayedVal = Math.max(
          0,
          asteroid.value - asteroid.stability * s.transit_time
        );
        s.tons = tons;
        s.decayed_value = decayedVal;
        s.earnings = tons * decayedVal;
        delete s._tiebreak; // internal only, don't leak into stored data
      }
    }

    return {
      asteroid: asteroid.name,
      pool: asteroid.pool,
      remaining: remainingPool,
      ships: [...shipsHere].sort((a, b) => a.arrival_cycle - b.arrival_cycle),
    };
  });

  const leaderboard = teams
    .map((team) => {
      const teamShips = allShips.filter((s) => s.team === team.name);
      const totalEarnings = teamShips.reduce((sum, s) => sum + s.earnings, 0);
      return {
        ...team,
        total_earnings: totalEarnings,
        final_score: totalEarnings + team.leftover,
      };
    })
    .sort((a, b) => b.final_score - a.final_score);

  return { leaderboard, shipLog: allShips, asteroidLog };
}