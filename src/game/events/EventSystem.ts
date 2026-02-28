import { getResourceEntity } from '@/ecs/archetypes';
import { createGameView } from '../GameView';
import type { CommendationSource, MarkSource, PersonnelFile } from '../PersonnelFile';
import type { GameRng } from '../SeedSystem';
import { EVENT_BASE_PROBABILITY, EVENT_COOLDOWN_TICKS, MAX_RECENT_MEMORY } from './constants';
import { getEventRng, pick, setEventRng } from './helpers';
import { ALL_EVENT_TEMPLATES } from './templates';
import type { EventTemplate, GameEvent } from './types';

// ─────────────────────────────────────────────────────────
//  EVENT → PERSONNEL FILE MAPPINGS
// ─────────────────────────────────────────────────────────

/** Events that add black marks, keyed by event ID → MarkSource. */
const EVENT_MARK_MAP: Partial<Record<string, MarkSource>> = {
  // Economic — black market / blat
  black_market: 'black_market',
  vodka_economy_boom: 'blat_noticed',
  // Economic — resource waste / quota risk
  currency_reform: 'quota_missed_minor',
  coal_shortage: 'quota_missed_major',
  bread_queue: 'quota_missed_minor',
  shortage_cascade: 'quota_missed_major',
  // Political — misconduct / KGB
  kgb_inspection: 'lying_to_kgb',
  defection_attempt: 'conscription_failed',
  purge_rumor: 'worker_arrested',
  kulak_purge: 'worker_arrested',
  great_terror_wave: 'worker_arrested',
  conscription_wave: 'conscription_failed',
  requisition_squad: 'quota_missed_major',
  freeze_crackdown: 'suppressing_news',
  reform_confusion: 'report_falsified',
  factory_output_report: 'report_falsified',
  // Disasters — major/catastrophic only
  power_station_explosion: 'quota_missed_catastrophic',
  factory_collapse: 'quota_missed_major',
  roof_collapse: 'construction_mandate',
  bandit_raid: 'quota_missed_major',
  bombardment: 'quota_missed_catastrophic',
  // Absurdist — minor political marks for especially absurd mismanagement
  bureaucracy_sentient: 'report_falsified',
};

/** Events that add commendations, keyed by event ID → CommendationSource. */
const EVENT_COMMENDATION_MAP: Partial<Record<string, CommendationSource>> = {
  // Economic windfalls
  potato_miracle: 'quota_exceeded',
  vodka_surplus: 'quota_exceeded',
  vodka_discovery: 'quota_exceeded',
  lost_rubles: 'quota_exceeded',
  stakhanovite_miracle: 'stakhanovite_celebrated',
  rubble_salvage: 'quota_exceeded',
  private_gardens_allowed: 'quota_exceeded',
  // Political recognition
  hero_award: 'inspection_passed',
  propaganda_boost: 'ideology_session_passed',
  western_spy_caught: 'inspection_passed',
};

// ─────────────────────────────────────────────────────────
//  SAVE DATA
// ─────────────────────────────────────────────────────────

export interface EventSystemSaveData {
  lastEventTick: number;
  recentEventIds: string[];
  eventHistory: GameEvent[];
}

// ─────────────────────────────────────────────────────────
//  EVENT SYSTEM CLASS
// ─────────────────────────────────────────────────────────

export class EventSystem {
  private lastEventTick = 0;
  private eventCooldownTicks = EVENT_COOLDOWN_TICKS;
  private recentEventIds: string[] = [];
  private maxRecentMemory = MAX_RECENT_MEMORY;
  private eventHistory: GameEvent[] = [];
  private personnelFile: PersonnelFile | null = null;
  private currentTick = 0;

  constructor(
    private onEventCallback: (event: GameEvent) => void,
    rng?: GameRng,
  ) {
    if (rng) setEventRng(rng);
  }

  /** Inject the PersonnelFile reference so events can add marks/commendations. */
  setPersonnelFile(file: PersonnelFile): void {
    this.personnelFile = file;
  }

  /** Called every simulation tick with the monotonic tick counter */
  public tick(totalTicks: number, eventFrequencyMult = 1): void {
    this.currentTick = totalTicks;
    if (totalTicks - this.lastEventTick < this.eventCooldownTicks) return;

    // 12% base chance per eligible tick, scaled by era modifier
    const rng = getEventRng();
    if ((rng?.random() ?? Math.random()) < EVENT_BASE_PROBABILITY * eventFrequencyMult) {
      const event = this.generateEvent();
      if (event) {
        this.applyEffects(event);
        this.applyPersonnelMarks(event);
        this.eventHistory.push(event);
        this.recentEventIds.push(event.id);
        if (this.recentEventIds.length > this.maxRecentMemory) {
          this.recentEventIds.shift();
        }
        this.onEventCallback(event);
        this.lastEventTick = totalTicks;
      }
    }
  }

  /** Force-trigger a specific event by ID */
  public triggerEvent(eventId: string): void {
    const template = ALL_EVENT_TEMPLATES.find((t) => t.id === eventId);
    if (!template) return;
    const event = this.resolveTemplate(template);
    this.applyEffects(event);
    this.applyPersonnelMarks(event);
    this.eventHistory.push(event);
    this.recentEventIds.push(event.id);
    if (this.recentEventIds.length > this.maxRecentMemory) {
      this.recentEventIds.shift();
    }
    this.onEventCallback(event);
  }

  /** Get the last N events for display */
  public getRecentEvents(count = 5): GameEvent[] {
    return this.eventHistory.slice(-count);
  }

  /** Get the most recent event */
  public getLastEvent(): GameEvent | null {
    return this.eventHistory.length > 0 ? this.eventHistory[this.eventHistory.length - 1]! : null;
  }

  // ── private ──────────────────────────────────────────

  private generateEvent(): GameEvent | null {
    const view = createGameView();
    // Filter to eligible events (condition met, not recently fired, era-matched)
    const eligible = ALL_EVENT_TEMPLATES.filter((t) => {
      if (this.recentEventIds.includes(t.id)) return false;
      if (t.eraFilter && !t.eraFilter.includes(view.currentEra)) return false;
      if (t.condition && !t.condition(view)) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Weighted random selection
    const rng = getEventRng();
    const totalWeight = eligible.reduce((sum, t) => sum + (t.weight ?? 1), 0);
    let roll = (rng?.random() ?? Math.random()) * totalWeight;
    for (const template of eligible) {
      roll -= template.weight ?? 1;
      if (roll <= 0) {
        return this.resolveTemplate(template);
      }
    }

    // Fallback
    return this.resolveTemplate(pick(eligible));
  }

  private resolveTemplate(template: EventTemplate): GameEvent {
    const gs = createGameView();

    const description = typeof template.description === 'function' ? template.description(gs) : template.description;

    const pravdaHeadline =
      typeof template.pravdaHeadline === 'function' ? template.pravdaHeadline(gs) : template.pravdaHeadline;

    const effects = typeof template.effects === 'function' ? template.effects(gs) : { ...template.effects };

    // Determine type for UI coloring
    const netImpact =
      (effects.money ?? 0) +
      (effects.food ?? 0) +
      (effects.vodka ?? 0) +
      (effects.pop ?? 0) * 10 +
      (effects.power ?? 0);

    let type: 'good' | 'bad' | 'neutral' = 'neutral';
    if (netImpact > 5) type = 'good';
    else if (netImpact < -5) type = 'bad';

    return {
      id: template.id,
      title: template.title,
      description,
      pravdaHeadline,
      category: template.category,
      severity: template.severity,
      effects,
      type,
    };
  }

  private applyEffects(event: GameEvent): void {
    const fx = event.effects;
    const store = getResourceEntity();
    if (!store) return;

    const r = store.resources;
    if (fx.money) r.money = Math.max(0, r.money + fx.money);
    if (fx.food) r.food = Math.max(0, r.food + fx.food);
    if (fx.vodka) r.vodka = Math.max(0, r.vodka + fx.vodka);
    if (fx.pop) r.population = Math.max(0, r.population + fx.pop);
    if (fx.power) r.power = Math.max(0, r.power + fx.power);
  }

  /**
   * Map a resolved event to PersonnelFile marks or commendations.
   * Uses explicit ID-based mappings first, ignoring trivial-severity events
   * that have no explicit mapping (cultural fluff, absurdist jokes, etc.).
   */
  private applyPersonnelMarks(event: GameEvent): void {
    if (!this.personnelFile) return;

    const markSource = EVENT_MARK_MAP[event.id];
    if (markSource) {
      this.personnelFile.addMark(markSource, this.currentTick, `Event: ${event.title}`);
      return;
    }

    const commendationSource = EVENT_COMMENDATION_MAP[event.id];
    if (commendationSource) {
      this.personnelFile.addCommendation(commendationSource, this.currentTick, `Event: ${event.title}`);
    }
  }

  // ── Serialization ──────────────────────────────────────

  serialize(): EventSystemSaveData {
    return {
      lastEventTick: this.lastEventTick,
      recentEventIds: [...this.recentEventIds],
      eventHistory: this.eventHistory.map((e) => ({ ...e, effects: { ...e.effects } })),
    };
  }

  static deserialize(
    data: EventSystemSaveData,
    onEventCallback: (event: GameEvent) => void,
    rng?: GameRng,
  ): EventSystem {
    const system = new EventSystem(onEventCallback, rng);
    system.lastEventTick = data.lastEventTick;
    system.recentEventIds = [...data.recentEventIds];
    system.eventHistory = data.eventHistory.map((e) => ({ ...e, effects: { ...e.effects } }));
    return system;
  }
}
