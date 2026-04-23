/**
 * Utility / callback functions used by the simulation.
 * Faithful port of poc.html lines 424-448 (helpers that modify gameState).
 *
 * These functions accept GameState so they can be used with either the
 * singleton or a test-injected instance.
 */

import { pushNotification } from '../ui/NotificationStore';
import { TICKER_MESSAGES } from './BuildingTypes';
import type { GameState, LensType, TabType } from './GameState';

// --- Floating text ---

/**
 * Adds a floating text label above a grid cell (e.g. "+200₽", "BUILT").
 * Text floats upward and fades out over 60 frames.
 *
 * @param state - GameState to add the floating text to
 * @param gridX - Grid column
 * @param gridY - Grid row
 * @param text  - Display text
 * @param color - CSS color string
 */
export function addFloatingText(state: GameState, gridX: number, gridY: number, text: string, color: string): void {
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

/**
 * Returns a random Pravda news ticker message.
 * The UI layer appends it to the scrolling crawl.
 *
 * @returns A random propaganda message string
 */
export function getRandomTickerMsg(): string {
  return TICKER_MESSAGES[Math.floor(Math.random() * TICKER_MESSAGES.length)];
}

/**
 * Pushes a ticker message event (no-op in current architecture).
 * In the POC this directly mutated the DOM. The UI layer now calls
 * `getRandomTickerMsg()` on a timer instead.
 *
 * @param _state - Unused GameState (retained for API compatibility)
 */
export function pushTickerMsg(_state: GameState): void {
  // The UI layer should poll or subscribe to render ticker messages.
  // We store the message in floatingTexts as a convention-free side channel
  // is not available. Alternatively the UI can call getRandomTickerMsg() on a timer.
}

// --- Speed / Lens / Tab ---

/**
 * Sets the simulation speed multiplier.
 *
 * @param state - GameState to modify
 * @param sp    - Speed multiplier (1 = normal, 2 = fast, 3 = fastest)
 */
export function setSpeed(state: GameState, sp: number): void {
  state.speed = sp;
}

/**
 * Sets the active visual overlay lens mode.
 *
 * @param state - GameState to modify
 * @param lens  - Lens mode to activate
 */
export function setLens(state: GameState, lens: LensType): void {
  state.activeLens = lens;
}

/**
 * Switches the active toolbar tab and resets the selected tool.
 *
 * @param state - GameState to modify
 * @param tab   - Tab to activate
 */
export function setTab(state: GameState, tab: TabType): void {
  state.activeTab = tab;
  state.selectedTool = 'none';
}

/**
 * Selects a legacy management tool.
 *
 * @param state - GameState to modify
 * @param tool  - Tool key to select (currently 'bulldoze' or 'none')
 */
export function selectTool(state: GameState, tool: string): void {
  state.selectedTool = tool;
}

// --- Toast ---

/**
 * In the POC, showToast() directly toggled DOM visibility.
 * Here we store the message on state. The UI layer reads `state._toast`
 * and renders / auto-hides it.
 */

/** A toast notification displayed as a banner across the top of the screen. */
export interface ToastMessage {
  /** Notification text */
  text: string;
  /** Creation timestamp (Date.now()) for auto-dismiss timing */
  timestamp: number;
}

/** An advisor message from Comrade Vanya displayed in the advisor panel. */
export interface AdvisorMessage {
  /** Advisor message text */
  text: string;
  /** Ministry source label (e.g. 'INDUSTRY', 'DEFENSE', 'PLANNING') */
  source?: string;
  /** Creation timestamp (Date.now()) */
  timestamp: number;
}

// We extend GameState dynamically through a well-known property convention.
// The GameState class does not include these to keep the port faithful,
// so we use a module-level side-channel that the UI can read.

let _currentToast: ToastMessage | null = null;
let _currentAdvisor: AdvisorMessage | null = null;

const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getDateLabel(state: GameState): string {
  const m = MONTH_NAMES[state.date.month] ?? '???';
  return `${m} ${state.date.year}`;
}

/**
 * Displays a toast notification banner and pushes it to the notification store.
 *
 * @param state - GameState (used for date label and notify trigger)
 * @param text  - Message text to display
 */
export function showToast(state: GameState, text: string): void {
  _currentToast = { text, timestamp: Date.now() };
  pushNotification(text, 'toast', getDateLabel(state));
  state.notify();
}

/**
 * Returns the current toast message, or null if none is active.
 *
 * @returns Current toast or null
 */
export function getToast(): ToastMessage | null {
  return _currentToast;
}

/** Clears the current toast message. */
export function clearToast(): void {
  _currentToast = null;
}

/**
 * Displays a Comrade Vanya advisor notification and pushes it to the notification store.
 *
 * @param state  - GameState (used for date label and notify trigger)
 * @param text   - Advisor message text
 * @param source - Optional ministry source label (e.g. 'INDUSTRY', 'DEFENSE')
 */
export function showAdvisor(state: GameState, text: string, source?: string): void {
  _currentAdvisor = { text, source, timestamp: Date.now() };
  pushNotification(text, 'advisor', getDateLabel(state), '\u262D');
  state.notify();
}

/**
 * Returns the current advisor message, or null if none is active.
 *
 * @returns Current advisor message or null
 */
export function getAdvisor(): AdvisorMessage | null {
  return _currentAdvisor;
}

/** Dismisses the current advisor message. */
export function dismissAdvisor(): void {
  _currentAdvisor = null;
}
