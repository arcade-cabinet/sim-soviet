/**
 * @module game/politburo/PolitburoSystem
 *
 * THE MINISTRY & POLITBURO SYSTEM — Thin orchestrator class.
 *
 * Generates a full Politburo around each General Secretary. Every minister
 * has personality, loyalty, competence, ambition, and corruption stats that
 * modify gameplay in their domain. Ministers conflict, conspire, get purged,
 * and occasionally coup the General Secretary.
 */

import { getMetaEntity, getResourceEntity } from '@/ecs/archetypes';
import type { GameEvent } from '../events';
import { createGameView } from '../GameView';
import type { GameRng } from '../SeedSystem';
import {
  APPOINTMENT_STRATEGIES,
  DEFAULT_MODIFIERS,
  MINISTRY_NAMES,
  PERSONALITY_MINISTRY_MATRIX,
  TENSION_RULES,
} from './constants';
import { calculateCoupChance, calculatePurgeChance } from './coups';
import { MINISTRY_EVENTS } from './events';
import {
  clamp,
  generateGeneralSecretary,
  generateId,
  generateMinister,
  pick,
  randInt,
  random,
  setRng,
  weightedSelect,
} from './ministers';
import { applyMinisterOverrides } from './modifiers';
import type { Faction, GeneralSecretary, Minister, MinistryModifiers, PolitburoState, TensionRule } from './types';
import { Ministry, PersonalityType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
//  SAVE DATA
// ─────────────────────────────────────────────────────────────────────────────

export interface PolitburoSaveData {
  generalSecretary: GeneralSecretary;
  ministers: Array<[Ministry, Minister]>;
  factions: Faction[];
  tensions: Array<[string, number]>;
  activeModifiers: MinistryModifiers;
  leaderHistory: GeneralSecretary[];
  purgeHistory: Array<{ minister: Minister; year: number; reason: string }>;
  corruptionMult: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  THE POLITBURO SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export class PolitburoSystem {
  private state: PolitburoState;
  private corruptionMult = 1;

  /** Set an external corruption multiplier (from EraSystem). */
  public setCorruptionMult(mult: number): void {
    this.corruptionMult = mult;
  }

  constructor(
    private onEvent: (event: GameEvent) => void,
    rng?: GameRng,
    initialYear?: number,
  ) {
    if (rng) setRng(rng);
    // Generate initial government
    const gs = generateGeneralSecretary(initialYear ?? getMetaEntity()?.gameMeta.date.year ?? 1922);
    const ministers = new Map<Ministry, Minister>();

    for (const ministry of Object.values(Ministry)) {
      ministers.set(ministry, generateMinister(ministry));
    }

    this.state = {
      generalSecretary: gs,
      ministers,
      factions: [],
      tensions: new Map(),
      activeModifiers: { ...DEFAULT_MODIFIERS },
      leaderHistory: [],
      purgeHistory: [],
    };

    this.recalculateModifiers();
    this.formFactions();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  public getState(): Readonly<PolitburoState> {
    return this.state;
  }

  public getModifiers(): Readonly<MinistryModifiers> {
    return this.state.activeModifiers;
  }

  public getMinister(ministry: Ministry): Minister | undefined {
    return this.state.ministers.get(ministry);
  }

  public getGeneralSecretary(): GeneralSecretary {
    return this.state.generalSecretary;
  }

  /**
   * Called every simulation tick by SimulationEngine.
   * Processes monthly/quarterly/annual events based on TickResult boundaries.
   */
  public tick(tickResult: { newMonth: boolean; newYear: boolean }): void {
    const { month } = getMetaEntity()!.gameMeta.date;

    // Monthly updates
    if (tickResult.newMonth) {
      this.updateMinisterStats();
      this.checkMinistryEvents();
      this.applyCorruptionDrain();
    }

    // Quarterly checks
    if (tickResult.newMonth && [1, 4, 7, 10].includes(month)) {
      this.checkTensions();
      this.checkPurges();
    }

    // Annual checks
    if (tickResult.newYear) {
      this.ageLeader();
      this.checkCoups();
      this.checkLeaderDeath();
      this.incrementTenure();
      this.formFactions();
      this.recalculateModifiers();
    }
  }

  /**
   * Force a leadership change (for testing or external triggers).
   */
  public forceSuccession(cause: GeneralSecretary['causeOfDeath']): void {
    this.triggerSuccession(cause);
  }

  // ── Private: Modifier Calculation ─────────────────────────────────────

  private recalculateModifiers(): void {
    const mods: MinistryModifiers = { ...DEFAULT_MODIFIERS };

    for (const [ministry, minister] of this.state.ministers) {
      const overrides = PERSONALITY_MINISTRY_MATRIX[ministry]?.[minister.personality];
      if (!overrides) continue;
      const competenceScale = 0.5 + minister.competence / 200;
      applyMinisterOverrides(mods, overrides, competenceScale);
    }

    this.state.activeModifiers = mods;
  }

  // ── Private: Minister Stat Updates ────────────────────────────────────

  private updateMinisterStats(): void {
    const gs = this.state.generalSecretary;

    for (const [_, minister] of this.state.ministers) {
      // Loyalty drift: toward GS personality compatibility
      const compatible = this.personalityCompatibility(gs.personality, minister.personality);
      const loyaltyDrift = compatible ? randInt(0, 3) : randInt(-3, 0);
      minister.loyalty = clamp(minister.loyalty + loyaltyDrift, 0, 100);

      // Ambition grows with tenure
      if (minister.tenure > 3) {
        minister.ambition = clamp(minister.ambition + randInt(0, 2), 0, 100);
      }

      // Corruption grows slowly
      minister.corruption = clamp(minister.corruption + randInt(0, 1), 0, 100);

      // Purge risk accumulates from low loyalty + high ambition
      if (minister.loyalty < 40 || minister.ambition > 70) {
        minister.purgeRisk = clamp(minister.purgeRisk + randInt(1, 5), 0, 100);
      } else {
        minister.purgeRisk = clamp(minister.purgeRisk - 2, 0, 100);
      }
    }
  }

  private personalityCompatibility(a: PersonalityType, b: PersonalityType): boolean {
    const compatMap: Record<PersonalityType, PersonalityType[]> = {
      [PersonalityType.ZEALOT]: [PersonalityType.ZEALOT, PersonalityType.MILITARIST],
      [PersonalityType.IDEALIST]: [PersonalityType.IDEALIST, PersonalityType.REFORMER, PersonalityType.POPULIST],
      [PersonalityType.REFORMER]: [PersonalityType.REFORMER, PersonalityType.TECHNOCRAT, PersonalityType.IDEALIST],
      [PersonalityType.TECHNOCRAT]: [PersonalityType.TECHNOCRAT, PersonalityType.REFORMER],
      [PersonalityType.APPARATCHIK]: [PersonalityType.APPARATCHIK, PersonalityType.TECHNOCRAT],
      [PersonalityType.POPULIST]: [PersonalityType.POPULIST, PersonalityType.IDEALIST, PersonalityType.REFORMER],
      [PersonalityType.MILITARIST]: [PersonalityType.MILITARIST, PersonalityType.ZEALOT],
      [PersonalityType.MYSTIC]: [PersonalityType.MYSTIC, PersonalityType.IDEALIST],
    };
    return compatMap[a]?.includes(b) ?? false;
  }

  // ── Private: Tension System ───────────────────────────────────────────

  private checkTensions(): void {
    for (const rule of TENSION_RULES) {
      const ministerA = this.state.ministers.get(rule.ministryA);
      const ministerB = this.state.ministers.get(rule.ministryB);
      if (!ministerA || !ministerB) continue;
      if (ministerA.personality !== rule.personalityA) continue;
      if (ministerB.personality !== rule.personalityB) continue;

      const key = `${rule.ministryA}_${rule.ministryB}`;
      const current = this.state.tensions.get(key) ?? 0;
      const newTension = current + rule.tensionDelta / 4; // Quarterly portion
      this.state.tensions.set(key, newTension);

      // Tension threshold: generate conflict event
      if (newTension > 50) {
        this.generateTensionEvent(rule, ministerA, ministerB);
        this.state.tensions.set(key, newTension - 30); // Reduce after event
      }

      // Alliance threshold: cooperation bonus
      if (newTension < -30) {
        this.generateAllianceEvent(rule, ministerA, ministerB);
        this.state.tensions.set(key, newTension + 15);
      }
    }
  }

  private generateTensionEvent(rule: TensionRule, a: Minister, b: Minister): void {
    const event: GameEvent = {
      id: `tension_${a.ministry}_${b.ministry}_${Date.now()}`,
      title: 'INTER-MINISTRY CONFLICT',
      description: rule.description,
      pravdaHeadline: 'HEALTHY DEBATE BETWEEN MINISTRIES DEMONSTRATES STRENGTH OF SYSTEM',
      category: 'political',
      severity: 'minor',
      effects: { money: -20 },
      type: 'bad',
    };
    this.onEvent(event);

    // Tension lowers both ministers' loyalty
    a.loyalty = clamp(a.loyalty - 5, 0, 100);
    b.loyalty = clamp(b.loyalty - 5, 0, 100);
  }

  private generateAllianceEvent(rule: TensionRule, a: Minister, b: Minister): void {
    const event: GameEvent = {
      id: `alliance_${a.ministry}_${b.ministry}_${Date.now()}`,
      title: 'INTER-MINISTRY COOPERATION',
      description: rule.description,
      pravdaHeadline: 'MINISTRIES DEMONSTRATE UNITY OF SOCIALIST PURPOSE',
      category: 'political',
      severity: 'trivial',
      effects: { money: 10 },
      type: 'good',
    };
    this.onEvent(event);
  }

  // ── Private: Ministry Events ──────────────────────────────────────────

  private checkMinistryEvents(): void {
    if (random() > 0.15) return;

    const eligible = this.getEligibleMinistryEvents();
    if (eligible.length === 0) return;

    const selected = weightedSelect(eligible);
    this.onEvent(this.buildMinistryEvent(selected));
  }

  /** Filter ministry event templates to those matching the current cabinet. */
  private getEligibleMinistryEvents() {
    return MINISTRY_EVENTS.filter((template) => {
      const minister = this.state.ministers.get(template.ministry);
      if (!minister) return false;
      if (template.requiredPersonality && minister.personality !== template.requiredPersonality) return false;
      if (template.condition && !template.condition(minister, createGameView())) return false;
      return true;
    });
  }

  /** Build a GameEvent from a selected ministry event template. */
  private buildMinistryEvent(selected: (typeof MINISTRY_EVENTS)[number]): GameEvent {
    const minister = this.state.ministers.get(selected.ministry)!;
    const view = createGameView();
    const description =
      typeof selected.description === 'function' ? selected.description(minister, view) : selected.description;
    const effects = typeof selected.effects === 'function' ? selected.effects(minister, view) : { ...selected.effects };
    const netImpact =
      (effects.money ?? 0) +
      (effects.food ?? 0) +
      (effects.vodka ?? 0) +
      (effects.pop ?? 0) * 10 +
      (effects.power ?? 0);

    return {
      id: selected.id,
      title: selected.title,
      description,
      pravdaHeadline: selected.pravdaHeadline,
      category: selected.category,
      severity: selected.severity,
      effects,
      type: netImpact > 5 ? 'good' : netImpact < -5 ? 'bad' : 'neutral',
    };
  }

  // ── Private: Corruption ───────────────────────────────────────────────

  private applyCorruptionDrain(): void {
    let totalDrain = 0;
    for (const [_, minister] of this.state.ministers) {
      totalDrain += Math.floor(minister.corruption / 10); // 0-10 rubles per minister per month
    }
    totalDrain += Math.floor(this.state.activeModifiers.corruptionDrain);
    totalDrain = Math.floor(totalDrain * this.corruptionMult);
    const store = getResourceEntity();
    if (store) {
      store.resources.money = Math.max(0, store.resources.money - totalDrain);
    }
  }

  // ── Private: Purge Checks ────────────────────────────────────────────

  private checkPurges(): void {
    const gs = this.state.generalSecretary;
    const purgeTargets: Minister[] = [];

    for (const [_, minister] of this.state.ministers) {
      const chance = calculatePurgeChance(minister, gs);
      if (random() < chance / 4) {
        // Quarterly check = divide by 4
        purgeTargets.push(minister);
      }
    }

    for (const target of purgeTargets) {
      this.purgeMinister(target, "General Secretary's paranoia");
    }
  }

  private purgeMinister(minister: Minister, reason: string): void {
    this.state.purgeHistory.push({
      minister: { ...minister },
      year: getMetaEntity()?.gameMeta.date.year ?? 1922,
      reason,
    });

    // Generate purge event
    const event: GameEvent = {
      id: `purge_${minister.id}`,
      title: 'MINISTERIAL PURGE',
      description: `${MINISTRY_NAMES[minister.ministry]} ${minister.name} has been removed from office. Reason: "${reason}." ${minister.name} has been reassigned to counting trees in Siberia.`,
      pravdaHeadline: `FORMER ${MINISTRY_NAMES[minister.ministry].toUpperCase()} VOLUNTARILY RETIRES TO PURSUE FORESTRY`,
      category: 'political',
      severity: 'major',
      effects: {},
      type: 'neutral',
    };
    this.onEvent(event);

    // Replace with new minister loyal to current GS
    const strategy = APPOINTMENT_STRATEGIES[this.state.generalSecretary.personality];
    const newPersonality = pick(strategy.preferredTypes);
    const replacement = generateMinister(minister.ministry, newPersonality);
    replacement.loyalty = clamp(replacement.loyalty + 20, 0, 100); // New appointees are more loyal
    this.state.ministers.set(minister.ministry, replacement);

    // Paranoia increases after purge
    this.state.generalSecretary.paranoia = clamp(this.state.generalSecretary.paranoia + randInt(3, 8), 0, 100);

    this.recalculateModifiers();
  }

  // ── Private: Coup Checks ─────────────────────────────────────────────

  private checkCoups(): void {
    const gs = this.state.generalSecretary;

    for (const [_, minister] of this.state.ministers) {
      const factionSize = minister.factionId
        ? (this.state.factions.find((f) => f.id === minister.factionId)?.memberIds.length ?? 1)
        : 1;

      const chance = calculateCoupChance(minister, gs, factionSize);

      if (random() < chance) {
        this.executeCoup(minister);
        return; // Only one coup per year
      }
    }
  }

  private executeCoup(couper: Minister): void {
    const oldLeader = this.state.generalSecretary;
    oldLeader.alive = false;
    oldLeader.causeOfDeath = 'coup';
    this.state.leaderHistory.push({ ...oldLeader });

    const event: GameEvent = {
      id: `coup_${couper.id}`,
      title: 'PALACE COUP',
      description: `${MINISTRY_NAMES[couper.ministry]} ${couper.name} has seized power! Former General Secretary ${oldLeader.name} "has retired for health reasons." His health: terminal.`,
      pravdaHeadline: `SMOOTH TRANSITION OF POWER: NEW LEADERSHIP BRINGS FRESH VISION`,
      category: 'political',
      severity: 'catastrophic',
      effects: { money: -100, pop: -5 },
      type: 'bad',
    };
    this.onEvent(event);

    // The couper becomes General Secretary
    const newGS: GeneralSecretary = {
      id: generateId(),
      name: couper.name,
      personality: couper.personality,
      paranoia: randInt(50, 90), // Coup leaders are paranoid
      health: randInt(50, 80),
      age: randInt(50, 70),
      yearAppointed: getMetaEntity()?.gameMeta.date.year ?? 1922,
      alive: true,
    };

    this.state.generalSecretary = newGS;
    this.staffNewCabinet();
    this.recalculateModifiers();
  }

  // ── Private: Leader Health & Death ────────────────────────────────────

  private ageLeader(): void {
    const gs = this.state.generalSecretary;
    gs.age++;

    // Health decay: faster with age and paranoia
    const healthDecay = Math.floor((gs.age - 50) / 5) + Math.floor(gs.paranoia / 30);
    gs.health = clamp(gs.health - randInt(1, healthDecay + 1), 0, 100);
  }

  private checkLeaderDeath(): void {
    const gs = this.state.generalSecretary;
    if (gs.health <= 0) {
      this.triggerSuccession('natural');
    }

    // Additional chance of sudden death based on age
    if (gs.age > 70 && random() < (gs.age - 70) / 100) {
      gs.health = 0;
      this.triggerSuccession('natural');
    }
  }

  private triggerSuccession(cause: GeneralSecretary['causeOfDeath']): void {
    const oldLeader = this.state.generalSecretary;
    if (!oldLeader.alive) return; // Prevent double-trigger

    oldLeader.alive = false;
    oldLeader.causeOfDeath = cause;
    this.state.leaderHistory.push({ ...oldLeader });

    const causeText =
      cause === 'natural'
        ? 'after a long illness heroically endured'
        : cause === 'coup'
          ? 'due to sudden retirement'
          : 'under circumstances that are classified';

    const newGS = generateGeneralSecretary(getMetaEntity()?.gameMeta.date.year ?? 1922);

    const event: GameEvent = {
      id: `succession_${oldLeader.id}`,
      title: 'LEADERSHIP TRANSITION',
      description: `General Secretary ${oldLeader.name} has departed ${causeText}. New General Secretary ${newGS.name} (${newGS.personality}) takes the helm. The State endures.`,
      pravdaHeadline: `NEW ERA OF PROSPERITY BEGINS UNDER VISIONARY LEADERSHIP OF ${newGS.name.toUpperCase()}`,
      category: 'political',
      severity: 'catastrophic',
      effects: { money: -50 },
      type: 'neutral',
    };
    this.onEvent(event);

    this.state.generalSecretary = newGS;
    this.staffNewCabinet();
    this.recalculateModifiers();
  }

  // ── Private: Cabinet Staffing ─────────────────────────────────────────

  private staffNewCabinet(): void {
    const gs = this.state.generalSecretary;
    const strategy = APPOINTMENT_STRATEGIES[gs.personality];
    const oldMinisters = new Map(this.state.ministers);

    for (const ministry of Object.values(Ministry)) {
      const oldMinister = oldMinisters.get(ministry);
      if (this.retainMinister(ministry, oldMinister, strategy)) continue;
      this.appointNewMinister(ministry, strategy);
    }

    this.formFactions();
  }

  /** Attempt to retain a minister during a leadership transition. Returns true if retained. */
  private retainMinister(
    ministry: Ministry,
    oldMinister: Minister | undefined,
    strategy: (typeof APPOINTMENT_STRATEGIES)[PersonalityType],
  ): boolean {
    if (!oldMinister) return false;

    // KGB Chairman special case: they know too much
    if (ministry === Ministry.KGB && !strategy.purgesKGB) {
      oldMinister.survivedTransition = true;
      oldMinister.loyalty = clamp(oldMinister.loyalty - 10, 0, 100);
      oldMinister.ambition = clamp(oldMinister.ambition + 10, 0, 100);
      return true;
    }

    if (random() >= strategy.retentionRate) return false;
    if (strategy.meritBased && oldMinister.competence < 40) return false;
    if (oldMinister.loyalty < strategy.loyaltyThreshold) return false;

    oldMinister.survivedTransition = true;
    oldMinister.loyalty = clamp(oldMinister.loyalty + randInt(-10, 10), 0, 100);
    return true;
  }

  /** Appoint a fresh minister to a ministry post. */
  private appointNewMinister(ministry: Ministry, strategy: (typeof APPOINTMENT_STRATEGIES)[PersonalityType]): void {
    const newPersonality = pick(strategy.preferredTypes);
    const newMinister = generateMinister(ministry, newPersonality);
    newMinister.loyalty = clamp(newMinister.loyalty + 15, 0, 100);
    this.state.ministers.set(ministry, newMinister);
  }

  // ── Private: Faction Formation ────────────────────────────────────────

  private formFactions(): void {
    this.state.factions = [];
    const ministersByPersonality = new Map<PersonalityType, Minister[]>();

    for (const [_, minister] of this.state.ministers) {
      const list = ministersByPersonality.get(minister.personality) ?? [];
      list.push(minister);
      ministersByPersonality.set(minister.personality, list);
    }

    for (const [personality, members] of ministersByPersonality) {
      if (members.length >= 2) {
        const faction: Faction = {
          id: `faction_${personality}_${Date.now()}`,
          name: `${personality.charAt(0).toUpperCase() + personality.slice(1)} Bloc`,
          alignment: personality,
          memberIds: members.map((m) => m.id),
          influence: members.reduce((sum, m) => sum + m.competence + m.ambition, 0),
          supportsCurrent: this.personalityCompatibility(this.state.generalSecretary.personality, personality),
        };

        for (const member of members) {
          member.factionId = faction.id;
        }

        this.state.factions.push(faction);
      }
    }
  }

  // ── Private: Tenure ───────────────────────────────────────────────────

  private incrementTenure(): void {
    for (const [_, minister] of this.state.ministers) {
      minister.tenure++;
    }
  }

  // ── Serialization ─────────────────────────────────────────────────────

  serialize(): PolitburoSaveData {
    return {
      generalSecretary: { ...this.state.generalSecretary },
      ministers: Array.from(this.state.ministers.entries()).map(([k, v]) => [k, { ...v }] as [Ministry, Minister]),
      factions: this.state.factions.map((f) => ({ ...f, memberIds: [...f.memberIds] })),
      tensions: Array.from(this.state.tensions.entries()),
      activeModifiers: { ...this.state.activeModifiers },
      leaderHistory: this.state.leaderHistory.map((l) => ({ ...l })),
      purgeHistory: this.state.purgeHistory.map((p) => ({
        minister: { ...p.minister },
        year: p.year,
        reason: p.reason,
      })),
      corruptionMult: this.corruptionMult,
    };
  }

  static deserialize(data: PolitburoSaveData, onEvent: (event: GameEvent) => void, rng?: GameRng): PolitburoSystem {
    // Create a minimal instance — we bypass the normal constructor by
    // using Object.create so that no random generation occurs.
    const system = Object.create(PolitburoSystem.prototype) as PolitburoSystem;

    if (rng) setRng(rng);

    // Restore the onEvent callback (it's a private constructor param)
    (system as unknown as { onEvent: (event: GameEvent) => void }).onEvent = onEvent;

    system.corruptionMult = data.corruptionMult;
    system.state = {
      generalSecretary: { ...data.generalSecretary },
      ministers: new Map(data.ministers.map(([k, v]) => [k, { ...v }])),
      factions: data.factions.map((f) => ({ ...f, memberIds: [...f.memberIds] })),
      tensions: new Map(data.tensions),
      activeModifiers: { ...data.activeModifiers },
      leaderHistory: data.leaderHistory.map((l) => ({ ...l })),
      purgeHistory: data.purgeHistory.map((p) => ({
        minister: { ...p.minister },
        year: p.year,
        reason: p.reason,
      })),
    };

    return system;
  }
}
