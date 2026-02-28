/**
 * simTick — the COMPLETE simulation tick, heart of the game.
 * Faithful port of poc.html lines 618-868.
 */

import { GRID_SIZE, TICKS_PER_MONTH } from './GridTypes';
import type { GameState, BuildingInstance } from './GameState';
import { BUILDING_TYPES, GROWN_TYPES } from './BuildingTypes';
import { DIRECTIVES } from './Directives';
import { getSeason, updateWeatherSystem } from './WeatherSystem';
import { updateWaterNetwork } from './WaterNetwork';
import { addFloatingText, showToast, showAdvisor, setSpeed } from './helpers';

export function simTick(state: GameState): void {
  state.date.tick++;
  let isMonthPassed = false;

  // --- Directive checking ---
  const currentDir = DIRECTIVES[state.directiveIndex];
  if (currentDir && currentDir.check()) {
    state.money += currentDir.reward;
    showToast(state, `DIRECTIVE COMPLETE: +${currentDir.reward}₽`);
    addFloatingText(
      state,
      GRID_SIZE / 2,
      GRID_SIZE / 2,
      `DIRECTIVE: +${currentDir.reward}₽`,
      '#cfaa48'
    );
    state.directiveIndex++;
    if (DIRECTIVES[state.directiveIndex]) {
      showAdvisor(
        state,
        'New Directive Issued: ' + DIRECTIVES[state.directiveIndex].text
      );
    }
    state.notify();
  }

  // --- Storm lightning ---
  if (state.currentWeather === 'storm' && Math.random() < 0.15) {
    const lx = Math.floor(Math.random() * GRID_SIZE);
    const ly = Math.floor(Math.random() * GRID_SIZE);
    state.activeLightning = { x: lx, y: ly, life: 15 };
    const cell = state.grid[ly][lx];

    const activeGulags = state.buildings.filter(
      (b) =>
        b.type === 'gulag' &&
        state.grid[b.y][b.x].onFire === 0 &&
        b.powered !== false
    );
    const isPacified = activeGulags.some(
      (g) => Math.hypot(g.x - lx, g.y - ly) <= 7
    );

    if (
      cell.type &&
      cell.type !== 'road' &&
      cell.type !== 'pipe' &&
      !isPacified &&
      cell.onFire === 0
    ) {
      cell.onFire = 1;
      showToast(state, 'LIGHTNING STRUCK A BUILDING!');
    } else if (cell.terrain === 'tree' && !cell.type && !isPacified) {
      cell.terrain = 'grass';
    }
  }

  // --- Meteor spawn ---
  if (
    !state.meteor.active &&
    !state.meteor.struck &&
    Math.random() < 0.01 &&
    state.date.year >= 1980 &&
    state.date.month >= 6
  ) {
    state.meteor.active = true;
    do {
      state.meteor.tx =
        Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
      state.meteor.ty =
        Math.floor(Math.random() * (GRID_SIZE - 4)) + 2;
    } while (state.meteor.ty === state.train.y);
    state.meteor.x = state.meteor.tx + 15;
    state.meteor.y = state.meteor.ty - 15;
    state.meteor.z = 1800;
    showToast(state, '⚠️ MASSIVE RADAR ANOMALY DETECTED ⚠️');
    if (state.speed > 1) setSpeed(state, 1);
  }

  // --- Month transition ---
  if (state.date.tick >= TICKS_PER_MONTH) {
    state.date.tick = 0;
    isMonthPassed = true;
    const oldSeason = getSeason(state.date.month);
    state.date.month++;
    if (state.date.month > 12) {
      state.date.month = 1;
      state.date.year++;
      if (state.quota.target > 0) checkQuota(state);
    }

    const newSeason = getSeason(state.date.month);
    updateWeatherSystem(newSeason);

    // Monthly tax
    const tax = Math.floor(state.pop * 0.2) + 5;
    state.money += tax;
    state.lastIncome = tax;
    const houses = state.buildings.filter((b) => b.type === 'housing');
    if (houses.length > 0) {
      addFloatingText(
        state,
        houses[Math.floor(Math.random() * houses.length)].x,
        houses[Math.floor(Math.random() * houses.length)].y,
        `+${tax}₽ TAX`,
        '#ffca28'
      );
    } else {
      addFloatingText(
        state,
        GRID_SIZE / 2,
        GRID_SIZE / 2,
        `+${tax}₽ TAX`,
        '#ffca28'
      );
    }

    // Spring thaw — ice roads sink
    if (oldSeason === 'WINTER' && newSeason !== 'WINTER') {
      let sunkRoads = 0;
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const cell = state.grid[y][x];
          if (
            cell.terrain === 'water' &&
            cell.type === 'road' &&
            !cell.bridge &&
            !cell.isRail
          ) {
            cell.type = null;
            sunkRoads++;
            state.traffic = state.traffic.filter(
              (v) =>
                !(Math.round(v.x) === x && Math.round(v.y) === y)
            );
          }
        }
      }
      if (sunkRoads > 0) {
        showToast(state, `SPRING THAW: ${sunkRoads} ICE ROADS SUNK`);
      }
    }

    const activeTowers = state.buildings.filter(
      (b) =>
        b.type === 'tower' &&
        state.grid[b.y][b.x].onFire === 0 &&
        b.powered
    );
    const activeGulags = state.buildings.filter(
      (b) =>
        b.type === 'gulag' &&
        state.grid[b.y][b.x].onFire === 0 &&
        b.powered
    );

    // --- ZONING GROWTH LOGIC ---
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = state.grid[y][x];
        if (cell.zone && cell.onFire === 0) {
          if (!cell.type) {
            // Empty zone -> spawn Level 0 building
            if (cell.watered && Math.random() < 0.15) {
              const newType =
                cell.zone === 'res'
                  ? 'housing'
                  : cell.zone === 'farm'
                    ? 'farm'
                    : Math.random() > 0.5
                      ? 'factory'
                      : 'distillery';
              cell.type = newType;
              state.buildings.push({
                x,
                y,
                type: newType,
                powered: false,
                level: 0,
              });
              addFloatingText(state, x, y, 'BUILT', '#00e676');
            }
          } else if (GROWN_TYPES[cell.type]) {
            // Upgrade logic
            const b = state.buildings.find(
              (bl) => bl.x === x && bl.y === y
            );
            if (b && b.powered && cell.watered) {
              const maxLevel = GROWN_TYPES[b.type].length - 1;
              if (b.level < maxLevel && Math.random() < 0.08) {
                let canUpgrade = false;
                if (b.level === 0) {
                  canUpgrade = true; // Just need power/water which is checked above
                } else if (b.level === 1) {
                  // Level 2 -> Level 3 needs Aura and Low Smog
                  const hasAura =
                    activeTowers.some(
                      (t) => Math.hypot(t.x - x, t.y - y) <= 5
                    ) ||
                    activeGulags.some(
                      (g) => Math.hypot(g.x - x, g.y - y) <= 7
                    );
                  if (hasAura && cell.smog < 25) canUpgrade = true;
                }

                if (canUpgrade) {
                  b.level++;
                  addFloatingText(state, x, y, '+UPGRADE+', '#00e5ff');
                }
              }
            }
          }
        }
      }
    }
  }

  // --- Water network ---
  updateWaterNetwork(state);

  // --- Power / Water production tally ---
  let prodFood = 0;
  let prodVodka = 0;
  let prodPower = 0;
  let reqPower = 0;
  let prodWater = 0;
  let reqWater = 0;

  state.buildings.forEach((b) => {
    const baseStats =
      BUILDING_TYPES[b.type] ||
      (GROWN_TYPES[b.type] ? GROWN_TYPES[b.type][b.level || 0] : null);
    if (!baseStats) return;
    if (
      (b.type === 'power' || b.type === 'nuke' || b.type === 'tap') &&
      state.grid[b.y][b.x].onFire === 0
    ) {
      prodPower += (baseStats as any).power || 0;
    }
    if (b.type === 'pump' && state.grid[b.y][b.x].onFire === 0) {
      prodWater += (baseStats as any).water || 0;
    }
  });
  state.powerGen = prodPower;
  state.waterGen = prodWater;

  // --- Smog diffusion ---
  const nextSmog: number[][] = Array(GRID_SIZE)
    .fill(0)
    .map(() => Array(GRID_SIZE).fill(0));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (state.grid[y][x].terrain === 'irradiated') nextSmog[y][x] += 30;
      const s = state.grid[y][x].smog;
      if (s > 0) {
        const decay =
          state.currentWeather === 'rain' ||
          state.currentWeather === 'storm'
            ? 0.25
            : 0.35;
        const spread = s * 0.15;
        const kept = s * decay;
        nextSmog[y][x] += kept;
        if (x > 0) nextSmog[y][x - 1] += spread;
        if (x < GRID_SIZE - 1) nextSmog[y][x + 1] += spread;
        if (y > 0) nextSmog[y - 1][x] += spread;
        if (y < GRID_SIZE - 1) nextSmog[y + 1][x] += spread;
      }
    }
  }

  // --- Active towers / gulags / zeppelins (per-tick) ---
  const activeTowers = state.buildings.filter(
    (b) => b.type === 'tower' && state.grid[b.y][b.x].onFire === 0
  );
  const activeGulags = state.buildings.filter(
    (b) => b.type === 'gulag' && state.grid[b.y][b.x].onFire === 0
  );
  const activeMasts = state.buildings.filter(
    (b) =>
      b.type === 'mast' &&
      b.powered !== false &&
      state.grid[b.y][b.x].onFire === 0
  ).length;

  while (state.zeppelins.length < activeMasts) {
    state.zeppelins.push({
      x: Math.random() * GRID_SIZE,
      y: Math.random() * GRID_SIZE,
      tx: 15,
      ty: 15,
      lx: 15,
      ly: 15,
    });
  }
  while (state.zeppelins.length > activeMasts) {
    state.zeppelins.pop();
  }

  const starvation = state.food < Math.ceil(state.pop / 10);
  const sobering = state.vodka < Math.ceil(state.pop / 20);
  const destroyedThisTurn: BuildingInstance[] = [];
  let meltdownTriggered = false;
  const meltdownCoords: { x: number; y: number }[] = [];

  // --- Building simulation ---
  state.buildings.forEach((b) => {
    const stats =
      BUILDING_TYPES[b.type] ||
      (GROWN_TYPES[b.type] ? GROWN_TYPES[b.type][b.level || 0] : null);
    if (!stats) return;

    b.powered = true;
    const cell = state.grid[b.y][b.x];
    const isPacified = activeGulags.some(
      (g) =>
        Math.hypot(g.x - b.x, g.y - b.y) <= 7 && g.powered !== false
    );

    if (isPacified) cell.onFire = 0;

    if (cell.onFire > 0) {
      b.powered = false;
      if (isMonthPassed) {
        cell.onFire++;
        if (cell.onFire > 2 && Math.random() < 0.2) {
          const neighbors = [
            { x: b.x + 1, y: b.y },
            { x: b.x - 1, y: b.y },
            { x: b.x, y: b.y + 1 },
            { x: b.x, y: b.y - 1 },
          ];
          neighbors.forEach((n) => {
            if (
              n.x >= 0 &&
              n.x < GRID_SIZE &&
              n.y >= 0 &&
              n.y < GRID_SIZE
            ) {
              const nCell = state.grid[n.y][n.x];
              if (
                nCell.type &&
                nCell.type !== 'road' &&
                nCell.onFire === 0 &&
                !activeGulags.some(
                  (g) => Math.hypot(g.x - n.x, g.y - n.y) <= 7
                )
              ) {
                nCell.onFire = 1;
              }
            }
          });
        }
        if (cell.onFire > 15) {
          destroyedThisTurn.push(b);
          if (b.type === 'nuke') {
            meltdownTriggered = true;
            meltdownCoords.push({ x: b.x, y: b.y });
          }
        }
      }
    } else {
      if ((stats as any).powerReq) {
        reqPower += (stats as any).powerReq;
        if (reqPower > state.powerGen) b.powered = false;
      }
      if ((stats as any).waterReq) {
        reqWater += (stats as any).waterReq;
        if (!cell.watered || reqWater > state.waterGen) b.powered = false;
      }
    }

    if (b.powered && cell.onFire === 0) {
      // Cosmodrome progress
      if (b.type === 'space' && !b.launched) {
        b.progress = (b.progress || 0) + 1;
        if (b.progress >= 60) {
          b.launched = true;
          state.activeLaunch = { x: b.x, y: b.y, alt: 0, vel: 0 };
          showToast(state, '🚀 SPACE RACE WON! 🚀');
          state.quota.target = 0;
        }
      }

      // Production multiplier from propaganda towers
      let multiplier = 1;
      if (
        (stats as any).prod &&
        activeTowers.some(
          (t) =>
            Math.hypot(t.x - b.x, t.y - b.y) <= 5 &&
            t.powered !== false
        )
      ) {
        multiplier = 2;
      }

      if (isMonthPassed && (stats as any).prod) {
        const amount = (stats as any).amt * multiplier;
        if ((stats as any).prod === 'food') {
          prodFood += amount;
          addFloatingText(state, b.x, b.y, `+${amount}🥔`, '#00e676');
        }
        if ((stats as any).prod === 'vodka') {
          prodVodka += amount;
          addFloatingText(state, b.x, b.y, `+${amount}🍾`, '#00e5ff');
        }
        if ((stats as any).prod === 'money') {
          state.money += amount;
          addFloatingText(state, b.x, b.y, `+${amount}₽`, '#fbc02d');
        }
      }

      // Gulag population drain
      if (b.type === 'gulag' && state.pop > 0 && Math.random() < 0.1) {
        state.pop--;
      }

      // Pollution
      if ((stats as any).pollution) {
        nextSmog[b.y][b.x] += (stats as any).pollution;
      }

      // Random riots
      if (
        !isPacified &&
        !['tower', 'gulag', 'mast', 'space', 'station', 'tap', 'pump'].includes(
          b.type
        )
      ) {
        let riotChance = 0;
        if (starvation) riotChance += 0.05;
        if (sobering) riotChance += 0.02;
        if (cell.smog > 40) riotChance += 0.05;
        if (Math.random() < riotChance) {
          cell.onFire = 1;
          showToast(state, 'RIOT DETECTED!');
          if (state.speed > 1) setSpeed(state, 1);
        }
      }
    } else if (
      isMonthPassed &&
      cell.zone &&
      !b.powered &&
      Math.random() < 0.2
    ) {
      // Abandonment if unpowered
      if (b.level > 0) {
        b.level--;
        addFloatingText(state, b.x, b.y, '-DECAY-', '#ff5252');
      } else {
        destroyedThisTurn.push(b);
        addFloatingText(state, b.x, b.y, 'ABANDONED', '#cfd8dc');
      }
    }
  });

  state.powerUsed = reqPower;
  state.waterUsed = reqWater;

  // --- Remove destroyed buildings ---
  destroyedThisTurn.forEach((b) => {
    const c = state.grid[b.y][b.x];
    c.type = null;
    c.onFire = 0;
    state.buildings = state.buildings.filter(
      (ob) => !(ob.x === b.x && ob.y === b.y)
    );
  });

  // --- Meltdown ---
  if (meltdownTriggered) {
    showToast(state, '☢️ CATASTROPHIC MELTDOWN ☢️');
    meltdownCoords.forEach((mc) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.hypot(dx, dy) <= 3.5) {
            const nx = mc.x + dx;
            const ny = mc.y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
              state.grid[ny][nx].terrain = 'irradiated';
              state.grid[ny][nx].type = null;
              state.grid[ny][nx].zone = null;
              state.grid[ny][nx].onFire = 0;
              if (!state.grid[ny][nx].isRail) {
                state.grid[ny][nx].bridge = false;
              }
              state.buildings = state.buildings.filter(
                (ob) => !(ob.x === nx && ob.y === ny)
              );
            }
          }
        }
      }
    });
  }

  // --- Apply smog ---
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      state.grid[y][x].smog = nextSmog[y][x];
    }
  }

  // --- Food consumption ---
  const foodNeed = Math.ceil(state.pop / 10);
  if (state.food >= foodNeed) {
    state.food += prodFood - foodNeed;
  } else {
    state.pop = Math.max(0, state.pop - 5);
    if (isMonthPassed) showToast(state, 'STARVATION');
  }

  // --- Vodka consumption ---
  state.vodka += prodVodka;
  const vodkaDrink = Math.ceil(state.pop / 20);
  if (state.vodka >= vodkaDrink) state.vodka -= vodkaDrink;

  // --- Population growth / smog deaths ---
  let housingCap = 0;
  let smogDeaths = 0;
  state.buildings.forEach((b) => {
    if (
      b.type === 'housing' &&
      b.powered &&
      state.grid[b.y][b.x].onFire === 0
    ) {
      housingCap += GROWN_TYPES[b.type][b.level || 0].cap!;
      if (state.grid[b.y][b.x].smog > 40) {
        smogDeaths += Math.floor(state.grid[b.y][b.x].smog / 20);
      }
    }
  });

  if (smogDeaths > 0 && isMonthPassed) {
    state.pop = Math.max(0, state.pop - smogDeaths);
    showToast(state, `CHOKING: -${smogDeaths} POPULATION`);
  } else if (
    state.pop < housingCap &&
    state.food > 10 &&
    isMonthPassed
  ) {
    state.pop += Math.floor(Math.random() * 3);
  }

  // --- Quota tracking ---
  if (state.quota.target > 0) {
    if (state.quota.type === 'food') state.quota.current = state.food;
    if (state.quota.type === 'vodka') state.quota.current = state.vodka;
  }

  state.notify();
}

// --- Quota check (called at year-end) ---
function checkQuota(state: GameState): void {
  if (state.date.year >= state.quota.deadlineYear) {
    if (state.quota.current >= state.quota.target) {
      showToast(state, 'QUOTA MET. TARGET RECALCULATED.');
      state.quota.type = 'vodka';
      state.quota.target = 500;
      state.quota.deadlineYear = state.date.year + 5;
      state.quota.current = 0;
    } else {
      showAdvisor(
        state,
        'Min. Planning: You failed the 5-Year Plan. The KGB is at your door.',
        'PLANNING'
      );
      state.quota.deadlineYear += 5;
    }
  }
}
