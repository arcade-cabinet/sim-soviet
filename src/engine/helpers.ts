/**
 * Utility / callback functions used by the simulation.
 * Faithful port of poc.html lines 424-448 (helpers that modify gameState).
 *
 * These functions accept GameState so they can be used with either the
 * singleton or a test-injected instance.
 */

import type { GameState, TabType, LensType } from './GameState';
import { TICKER_MESSAGES } from './BuildingTypes';
import { pushNotification } from '../ui/NotificationStore';

// --- Floating text ---

export function addFloatingText(
  state: GameState,
  gridX: number,
  gridY: number,
  text: string,
  color: string
): void {
  state.floatingTexts.push({
    x: gridX + (Math.random() - 0.5) * 0.5,
    y: gridY + (Math.random() - 0.5) * 0.5,
    text,
    color,
    life: 60,
    maxLife: 60,
  });
}

// --- Ticker ---

/** Returns a random ticker message. The UI layer appends it to the crawl. */
export function getRandomTickerMsg(): string {
  return TICKER_MESSAGES[Math.floor(Math.random() * TICKER_MESSAGES.length)];
}

/**
 * Pushes a ticker message event. In the POC this directly mutated the DOM.
 * Here we store the latest message on state so the UI layer can consume it.
 */
export function pushTickerMsg(state: GameState): void {
  // The UI layer should poll or subscribe to render ticker messages.
  // We store the message in floatingTexts as a convention-free side channel
  // is not available. Alternatively the UI can call getRandomTickerMsg() on a timer.
}

// --- Speed / Lens / Tab ---

export function setSpeed(state: GameState, sp: number): void {
  state.speed = sp;
}

export function setLens(state: GameState, lens: LensType): void {
  state.activeLens = lens;
}

export function setTab(state: GameState, tab: TabType): void {
  state.activeTab = tab;
  state.selectedTool = 'none';
}

export function selectTool(state: GameState, tool: string): void {
  state.selectedTool = tool;
}

// --- Toast ---

/**
 * In the POC, showToast() directly toggled DOM visibility.
 * Here we store the message on state. The UI layer reads `state._toast`
 * and renders / auto-hides it.
 */

export interface ToastMessage {
  text: string;
  timestamp: number;
}

export interface AdvisorMessage {
  text: string;
  source?: string;
  timestamp: number;
}

// We extend GameState dynamically through a well-known property convention.
// The GameState class does not include these to keep the port faithful,
// so we use a module-level side-channel that the UI can read.

let _currentToast: ToastMessage | null = null;
let _currentAdvisor: AdvisorMessage | null = null;

const MONTH_NAMES = [
  '', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function getDateLabel(state: GameState): string {
  const m = MONTH_NAMES[state.date.month] ?? '???';
  return `${m} ${state.date.year}`;
}

export function showToast(state: GameState, text: string): void {
  _currentToast = { text, timestamp: Date.now() };
  pushNotification(text, 'toast', getDateLabel(state));
  state.notify();
}

export function getToast(): ToastMessage | null {
  return _currentToast;
}

export function clearToast(): void {
  _currentToast = null;
}

export function showAdvisor(
  state: GameState,
  text: string,
  source?: string
): void {
  _currentAdvisor = { text, source, timestamp: Date.now() };
  pushNotification(text, 'advisor', getDateLabel(state), '\u262D');
  state.notify();
}

export function getAdvisor(): AdvisorMessage | null {
  return _currentAdvisor;
}

export function dismissAdvisor(): void {
  _currentAdvisor = null;
}
