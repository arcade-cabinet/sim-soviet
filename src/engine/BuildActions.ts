/**
 * handleClick — building placement / bulldoze / zone / pipe / road logic.
 * Faithful port of poc.html lines 1413-1480.
 */

import { BUILDING_TYPES } from './BuildingTypes';
import type { GameState } from './GameState';
import { GRID_SIZE } from './GridTypes';
import { addFloatingText, showAdvisor, showToast } from './helpers';
import { updateWaterNetwork } from './WaterNetwork';
import { getSeason } from './WeatherSystem';

export function handleClick(state: GameState, x: number, y: number, isDrag: boolean = false): boolean {
  if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false;

  const tool = state.selectedTool;
  const bInfo = BUILDING_TYPES[tool];
  const cell = state.grid[y][x];
  const season = getSeason(state.date.month);

  // --- Bulldoze ---
  if (tool === 'bulldoze') {
    if (cell.type) {
      if (state.money >= 20) {
        state.money -= 20;
        cell.type = null;
        cell.onFire = 0;
        if (!cell.isRail) cell.bridge = false;
        state.buildings = state.buildings.filter((b) => !(b.x === x && b.y === y));
        addFloatingText(state, x, y, '-20₽', '#ff5252');
        state.notify();
        return true;
      } else {
        if (!isDrag) showAdvisor(state, 'Demolition requires 20 Rubles.', 'INDUSTRY');
        return false;
      }
    } else if (cell.zone) {
      cell.zone = null;
      return true;
    } else if (cell.terrain === 'tree') {
      if (state.money >= 5) {
        state.money -= 5;
        cell.terrain = 'grass';
        addFloatingText(state, x, y, '-5₽', '#ff5252');
        state.notify();
        return true;
      } else {
        if (!isDrag) showAdvisor(state, 'Cannot afford 5 Rubles for an axe?', 'INDUSTRY');
        return false;
      }
    } else if (cell.terrain === 'water') {
      if (!isDrag) showToast(state, 'CANNOT PURGE RIVER');
      return false;
    } else if (cell.terrain === 'irradiated') {
      if (!isDrag) showToast(state, 'CANNOT PURGE RADIATION');
      return false;
    } else if (cell.terrain === 'crater') {
      if (!isDrag) showToast(state, 'THE CRATER IS ETERNAL');
      return false;
    } else if (cell.terrain === 'rail') {
      if (!isDrag) showToast(state, 'THE STATE RAILWAY IS ETERNAL');
      return false;
    }
    return false;
  }

  // --- Special terrain checks ---
  if (tool === 'tap' && cell.terrain !== 'crater') {
    if (!isDrag) showAdvisor(state, 'The Cosmic Tap can ONLY be built on a Meteor Crater.', 'INDUSTRY');
    return false;
  }
  if (tool !== 'tap' && tool !== 'none' && tool !== 'bulldoze' && cell.terrain === 'crater') {
    if (!isDrag) showToast(state, 'CANNOT BUILD ON CRATER');
    return false;
  }
  if (cell.terrain === 'rail' && tool !== 'road' && tool !== 'pipe') {
    if (!isDrag) showToast(state, 'ONLY ROADS CROSS RAILS');
    return false;
  }
  if (tool === 'pump' && cell.terrain !== 'water') {
    if (!isDrag) showToast(state, 'PUMPS MUST BE ON WATER');
    return false;
  }

  // --- Road on water (ice road / bridge) ---
  if (tool === 'road' && cell.terrain === 'water') {
    if (season === 'WINTER') {
      if (state.money >= 10) {
        state.money -= 10;
        cell.type = 'road';
        if (!cell.isRail) cell.bridge = false;
        addFloatingText(state, x, y, '-10₽', '#ff5252');
        if (!isDrag) showToast(state, 'ICE ROAD BUILT (WILL MELT)');
        state.notify();
        return true;
      } else {
        if (!isDrag) showAdvisor(state, 'Not even 10 Rubles?', 'INDUSTRY');
        return false;
      }
    } else {
      if (state.money >= 50) {
        state.money -= 50;
        cell.type = 'road';
        cell.bridge = true;
        addFloatingText(state, x, y, '-50₽', '#ff5252');
        state.notify();
        return true;
      } else {
        if (!isDrag) showAdvisor(state, 'A Bridge requires 50 Rubles.', 'INDUSTRY');
        return false;
      }
    }
  }

  // --- General obstruction checks ---
  if (cell.type && tool !== 'pipe') {
    if (!isDrag) showToast(state, 'OBSTRUCTION');
    return false;
  }
  if (cell.terrain === 'water' && tool !== 'pump' && tool !== 'road') {
    if (!isDrag) showToast(state, 'CANNOT BUILD ON RIVER');
    return false;
  }
  if (cell.terrain === 'tree') {
    if (!isDrag) showToast(state, 'PURGE THE FOREST FIRST');
    return false;
  }
  if (cell.terrain === 'irradiated') {
    if (!isDrag) showToast(state, 'FATAL RADIATION');
    return false;
  }

  // --- Station must be near railway ---
  if (tool === 'station' && (y < state.train.y - 1 || y > state.train.y + 1)) {
    if (!isDrag) showAdvisor(state, 'Stations must be adjacent to the Railway.', 'INDUSTRY');
    return false;
  }

  // --- Afford and place ---
  if (state.money >= bInfo.cost) {
    state.money -= bInfo.cost;

    if (tool === 'pipe') {
      cell.hasPipe = true;
    } else if (tool.startsWith('zone-')) {
      cell.zone = tool.split('-')[1];
    } else {
      cell.type = tool;
      if (tool !== 'road') {
        state.buildings.push({ x, y, type: tool, powered: false, level: 0 });
      }
    }

    addFloatingText(state, x, y, `-${bInfo.cost}₽`, '#ff5252');
    state.notify();
    if (tool === 'pipe' || tool === 'pump') updateWaterNetwork(state);
    return true;
  } else {
    if (!isDrag) showAdvisor(state, 'Not enough Rubles.', 'INDUSTRY');
    return false;
  }
}
